import { createClient } from '@supabase/supabase-js'
import { extractTier1, hasTextLayer } from './tier1'
import { extractTier2 } from './tier2'
import { extractTier3 } from './tier3'
import type { ExtractionResult, TierResult } from './types'
import { sendNotification } from '@/lib/notifications/send-email'
import { syncJobsIfStale } from '@/lib/quickbooks/sync'
import { saveToStorage } from '@/lib/storage/save-to-storage'

// ---------------------------------------------------------------------------
// Service-role Supabase client (bypasses RLS)
// ---------------------------------------------------------------------------

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const STORAGE_BUCKET = 'bill-pdfs'

// ---------------------------------------------------------------------------
// Error helper — marks bill as ocr_error and writes a processing log entry
// ---------------------------------------------------------------------------

type SupabaseClient = ReturnType<typeof getServiceClient>

async function markOcrError(supabase: SupabaseClient, billId: string, error: string): Promise<void> {
  console.error(`[ocr] ${billId} → ocr_error: ${error}`)
  const { data: bill } = await supabase.from('bills').select('company_id').eq('bill_id', billId).single()
  await Promise.all([
    supabase.from('bills').update({ status: 'ocr_error' }).eq('bill_id', billId),
    supabase.from('processing_log').insert({
      bill_id:     billId,
      action:      'ocr_error',
      actor:       'system',
      after_state: { status: 'ocr_error', error },
    }),
    ...(bill?.company_id ? [sendNotification({
      companyId:  bill.company_id,
      event:      'pdf_unreadable',
      subject:    'PDF could not be read',
      body:       `A bill PDF could not be extracted automatically: ${error}. You can reprocess it or fill in the fields manually.`,
      billId,
    })] : []),
  ])
}

// ---------------------------------------------------------------------------
// processBill — entry point called after a bill record is created
// ---------------------------------------------------------------------------

export async function processBill(billId: string, opts?: { skipCredits?: boolean; userComment?: string; forceTier?: 2 | 3 }): Promise<void> {
  const supabase = getServiceClient()

  // 1. Load the bill record
  const { data: bill, error: billErr } = await supabase
    .from('bills')
    .select('bill_id, company_id, pdf_url, status')
    .eq('bill_id', billId)
    .single()

  if (billErr || !bill) {
    console.error(`[ocr] Bill not found (${billId}):`, billErr?.message)
    return
  }

  if (bill.status !== 'draft') {
    console.warn(`[ocr] Skipping bill ${billId} — status is ${bill.status}, expected draft`)
    return
  }

  // 2. Download PDF from storage
  const { data: fileData, error: downloadErr } = await supabase.storage
    .from(STORAGE_BUCKET)
    .download(bill.pdf_url)

  if (downloadErr || !fileData) {
    await markOcrError(supabase, billId, `PDF download failed: ${downloadErr?.message ?? 'no data'}`)
    return
  }

  const pdfBuffer = Buffer.from(await fileData.arrayBuffer())

  // 3. Run tiered extraction
  let result: ExtractionResult
  try {
    result = await runTieredExtraction(pdfBuffer, { forceTier: opts?.forceTier, userComment: opts?.userComment })
  } catch (err) {
    await markOcrError(supabase, billId, `Extraction failed: ${err instanceof Error ? err.message : String(err)}`)
    return
  }

  // 4. Duplicate detection — check vendor_name_raw + invoice_number (excluding self)
  let isDuplicate = false
  if (result.vendor_name_raw && result.invoice_number) {
    const { data: existing } = await supabase
      .from('bills')
      .select('bill_id')
      .eq('company_id', bill.company_id)
      .eq('vendor_name_raw', result.vendor_name_raw)
      .eq('invoice_number', result.invoice_number)
      .neq('bill_id', billId)
      .is('deleted_at', null)
      .limit(1)

    isDuplicate = (existing?.length ?? 0) > 0
  }

  // 5. Update the bill record
  const holdReason = isDuplicate
    ? `Duplicate held — invoice ${result.invoice_number} from ${result.vendor_name_raw} already exists`
    : null

  const { error: updateErr } = await supabase
    .from('bills')
    .update({
      status:                   isDuplicate ? 'draft' : 'ready',
      vendor_name_raw:          result.vendor_name_raw,
      invoice_number:           result.invoice_number,
      invoice_date:             result.invoice_date,
      due_date:                 result.due_date,
      vendor_po_reference:      result.vendor_po_reference,
      total:                    result.total,
      subtotal:                 result.subtotal,
      tax_amount:               result.tax_amount,
      ocr_tier:                 result.tier,
      ocr_confidence:           result.confidence,
      autopublish_hold_reason:  holdReason,
      ...(result.raw_text != null ? { raw_text: result.raw_text } : {}),
    })
    .eq('bill_id', billId)

  if (updateErr) {
    await markOcrError(supabase, billId, `Bill update failed: ${updateErr.message}`)
    return
  }

  if (isDuplicate) {
    console.log(`[ocr] Bill ${billId} flagged as duplicate`)
    await sendNotification({
      companyId:  bill.company_id,
      event:      'duplicate_held',
      subject:    `Duplicate invoice held`,
      body:       `Invoice ${result.invoice_number} from ${result.vendor_name_raw} already exists. The duplicate has been held for review.`,
      billId,
    })
  }

  // 5a. Vendor matching — find vendor by extracted name, link to bill
  let vendorId: string | null = null
  let vendorDefaultGlAccountId: string | null = null
  let vendorDefaultClassId: string | null = null
  let vendorHoldForJobMatch = false
  if (result.vendor_name_raw) {
    const { data: vendor } = await supabase
      .from('vendors')
      .select('vendor_id, billflow_gl_account_id, qb_default_gl_account_id, gl_account_source, billflow_class_id, hold_for_job_match')
      .eq('company_id', bill.company_id)
      .or(`vendor_name_extracted.ilike.${result.vendor_name_raw},vendor_name_display.ilike.${result.vendor_name_raw}`)
      .limit(1)
      .single()

    if (vendor) {
      vendorId = vendor.vendor_id
      vendorDefaultGlAccountId =
        vendor.billflow_gl_account_id ?? vendor.qb_default_gl_account_id ?? null
      vendorDefaultClassId = vendor.billflow_class_id ?? null
      vendorHoldForJobMatch = vendor.hold_for_job_match ?? false

      // Increment invoices_processed for new bills only (not reprocesses or duplicates)
      if (!isDuplicate && !opts?.skipCredits) {
        const { data: vCurrent } = await supabase
          .from('vendors')
          .select('invoices_processed')
          .eq('vendor_id', vendorId)
          .single()
        await supabase.from('vendors').update({
          invoices_processed: (vCurrent?.invoices_processed ?? 0) + 1,
          last_invoice_date: result.invoice_date ?? undefined,
        }).eq('vendor_id', vendorId)
      }

      await supabase.from('bills').update({ vendor_id: vendorId }).eq('bill_id', billId)
    } else {
      // New vendor — try to match from QB cache first
      const { data: qbMatch } = await supabase
        .from('qb_vendors_cache')
        .select('qb_vendor_id, name, default_expense_account_id, payment_terms')
        .eq('company_id', bill.company_id)
        .ilike('name', `%${result.vendor_name_raw}%`)
        .limit(1)
        .single()

      if (qbMatch) {
        // Cache match found — create vendor record with QB link
        const { data: created } = await supabase
          .from('vendors')
          .insert({
            company_id:               bill.company_id,
            vendor_name_extracted:    result.vendor_name_raw,
            vendor_name_display:      qbMatch.name,
            qb_vendor_id:             qbMatch.qb_vendor_id,
            qb_vendor_name:           qbMatch.name,
            qb_default_gl_account_id: qbMatch.default_expense_account_id ?? null,
            gl_account_source:        qbMatch.default_expense_account_id ? 'qb_default' : 'not_set',
            qb_payment_terms:         qbMatch.payment_terms ?? null,
            payment_terms_source:     qbMatch.payment_terms ? 'qb_default' : 'not_set',
            copy_po_to_qb_reference:  true,
            is_visible:               true,
            auto_publish_enabled:     false,
            hold_for_job_match:       false,
            invoices_processed:       isDuplicate ? 0 : 1,
            last_invoice_date:        result.invoice_date ?? null,
          })
          .select('vendor_id, billflow_gl_account_id, qb_default_gl_account_id, gl_account_source, billflow_class_id, hold_for_job_match')
          .single()

        if (created) {
          vendorId = created.vendor_id
          vendorDefaultGlAccountId = created.billflow_gl_account_id ?? created.qb_default_gl_account_id ?? null
          vendorDefaultClassId = created.billflow_class_id ?? null
          vendorHoldForJobMatch = created.hold_for_job_match ?? false
          await supabase.from('bills').update({ vendor_id: vendorId }).eq('bill_id', billId)
        }
      } else {
        // No QB cache match — leave bill unmatched so user creates vendor manually via the bill screen
        console.log(`[ocr] No QB cache match for "${result.vendor_name_raw}" (${billId}) — leaving unmatched for manual vendor creation`)
      }
    }
  }

  // 5b. Load line item mappings and rules for this vendor
  let mappings: Array<{ description_text: string; gl_account_id: string }> = []
  let rules: Array<{
    match_type: string
    conditions: Array<{ field: string; operator: string; value: string }>
    gl_account_id: string
    priority: number
  }> = []
  if (vendorId) {
    const [mappingsResult, rulesResult] = await Promise.all([
      supabase
        .from('vendor_line_item_mappings')
        .select('description_text, gl_account_id')
        .eq('vendor_id', vendorId),
      supabase
        .from('vendor_line_item_rules')
        .select('match_type, conditions, gl_account_id, priority')
        .eq('vendor_id', vendorId)
        .order('priority'),
    ])
    mappings = mappingsResult.data ?? []
    rules = (rulesResult.data ?? []) as typeof rules
  }

  // 5c. Insert line items with smart GL account assignment
  if (result.line_items.length > 0) {
    await supabase.from('bill_line_items').delete().eq('bill_id', billId)

    const lineItemRows = result.line_items.map((li) => {
      const desc = li.description ?? ''
      let glAccountId: string | null = null
      let glSource: 'stored_mapping' | 'rule' | 'qb_default' | 'not_set' = 'not_set'

      // 1. Check stored mappings (exact description match)
      const mapping = mappings.find(m => m.description_text.toLowerCase() === desc.toLowerCase())
      if (mapping) {
        glAccountId = mapping.gl_account_id
        glSource = 'stored_mapping'
      }

      // 2. Check rules (override mappings)
      if (!glAccountId || rules.length > 0) {
        const matchedRule = rules.find(rule => evaluateRule(rule, desc, li.unit_price ?? 0))
        if (matchedRule) {
          glAccountId = matchedRule.gl_account_id
          glSource = 'rule'
        }
      }

      // 3. Fall back to vendor default GL
      if (!glAccountId && vendorDefaultGlAccountId) {
        glAccountId = vendorDefaultGlAccountId
        glSource = 'qb_default'
      }

      const descLower = desc.toLowerCase()
      const isTaxLine = ['sales tax', ' tax', 'hst', 'gst', 'pst', 'qst', 'vat', 'excise tax'].some(
        kw => descLower === kw || descLower.startsWith(kw + ' ') || descLower.endsWith(' ' + kw)
      )

      return {
        bill_id:           billId,
        company_id:        bill.company_id,
        description:       li.description,
        quantity:          li.quantity,
        unit_cost:         li.unit_price,
        extended_cost:     li.total,
        sort_order:        li.sort_order,
        gl_account_id:     glAccountId,
        gl_account_source: glSource,
        class_id:          vendorDefaultClassId,
        is_tax_line:       isTaxLine,
      }
    })

    const { error: lineErr } = await supabase.from('bill_line_items').insert(lineItemRows)
    if (lineErr) {
      console.error(`[ocr] Line items insert failed (${billId}):`, lineErr.message)
    }
  }

  // 6. PO matching — if OCR found a vendor_po_reference, try to link to an open PO
  if (result.vendor_po_reference) {
    await tryMatchPO(supabase, billId, bill.company_id, result.vendor_po_reference, result.total ?? 0)
  }

  // 6.2 Job matching — if vendor has hold_for_job_match and no job is matched, hold bill
  if (!isDuplicate && vendorHoldForJobMatch && result.vendor_po_reference) {
    const jobMatched = await tryMatchJob(supabase, billId, bill.company_id, result.vendor_po_reference)
    if (!jobMatched) {
      await supabase.from('bills')
        .update({ status: 'pending_job_match', autopublish_hold_reason: `Waiting for job match — PO reference: ${result.vendor_po_reference}` })
        .eq('bill_id', billId)
    }
  }

  // 6.5 Deduct 1 credit for the processed bill (only if not a duplicate or reprocess — those are free)
  if (!isDuplicate && !opts?.skipCredits) {
    const { data: co } = await supabase
      .from('companies')
      .select('credit_balance')
      .eq('company_id', bill.company_id)
      .single()

    const newBalance = Math.max(0, (co?.credit_balance ?? 0) - 1)
    await Promise.all([
      supabase.from('companies').update({ credit_balance: newBalance }).eq('company_id', bill.company_id),
      supabase.from('credit_ledger').insert({
        company_id:  bill.company_id,
        amount:      -1,
        description: `Bill processed: ${result.vendor_name_raw ?? 'Unknown'} ${result.invoice_number ?? ''}`.trim(),
        bill_id:     billId,
      }),
    ])
  }

  // 7. Append processing log entry
  await supabase.from('processing_log').insert({
    bill_id:     billId,
    action:      'ocr_complete',
    actor:       'system',
    after_state: {
      status:          'ready',
      ocr_tier:        result.tier,
      ocr_confidence:  result.confidence,
      invoice_number:  result.invoice_number,
      invoice_date:    result.invoice_date,
      total:           result.total,
      line_item_count: result.line_items.length,
    },
  })

  // 8. Send success notification
  await sendNotification({
    companyId:  bill.company_id,
    event:      'bill_processed',
    subject:    `Bill processed: ${result.vendor_name_raw ?? 'Unknown vendor'}`,
    body:       `Invoice ${result.invoice_number ?? '(no number)'} from ${result.vendor_name_raw ?? 'Unknown vendor'} was captured and is ready for review.`,
    billId,
  })

  console.log(
    `[ocr] Bill ${billId} processed — tier ${result.tier}, confidence ${result.confidence}, ${result.line_items.length} line items`
  )

  // 9. Save to external storage (SFTP / Google Drive) if configured
  if (!isDuplicate) {
    try {
      await saveToStorage(billId, 'bill', bill.company_id)
    } catch (err) {
      console.error(`[ocr] saveToStorage failed for bill ${billId}:`, err)
    }
  }

  // 10. Immediately attempt auto-publish for this company — eligible bills publish without waiting for cron
  if (!isDuplicate) {
    try {
      const { runAutopublishForCompany } = await import('@/lib/autopublish/engine')
      await runAutopublishForCompany(bill.company_id)
    } catch (err) {
      console.error(`[ocr] Immediate autopublish attempt failed for company ${bill.company_id}:`, err)
    }
  }
}

// ---------------------------------------------------------------------------
// Job matching — match bill to QB job by PO reference field
// ---------------------------------------------------------------------------

export async function tryMatchJob(
  supabase: SupabaseClient,
  billId: string,
  companyId: string,
  poReference: string,
): Promise<boolean> {
  const normalised = poReference.trim().toLowerCase()

  const { data: jobs } = await supabase
    .from('qb_jobs_cache')
    .select('qb_job_id, job_number, job_name')
    .eq('company_id', companyId)

  if (!jobs || jobs.length === 0) return false

  let match = jobs.find(j => {
    const num  = j.job_number?.trim().toLowerCase()
    const name = j.job_name?.trim().toLowerCase()
    // Exact match on job number or name
    if (num === normalised || name === normalised) return true
    // PO reference contains the job number (e.g. "52256 Install" contains "52256")
    if (num && num.length >= 4 && normalised.includes(num)) return true
    // Job name contains the PO reference or vice versa
    if (name && (normalised.includes(name) || name.includes(normalised))) return true
    return false
  })

  // Cache miss — refresh from QB if stale (rate-limited to once per 5 min to prevent
  // stampede when multiple invoices process simultaneously), then retry once
  if (!match) {
    await syncJobsIfStale(companyId)
    const { data: freshJobs } = await supabase
      .from('qb_jobs_cache')
      .select('qb_job_id, job_number, job_name')
      .eq('company_id', companyId)
    match = (freshJobs ?? []).find(j => {
      const num  = j.job_number?.trim().toLowerCase()
      const name = j.job_name?.trim().toLowerCase()
      if (num === normalised || name === normalised) return true
      if (num && num.length >= 4 && normalised.includes(num)) return true
      if (name && (normalised.includes(name) || name.includes(normalised))) return true
      return false
    }) ?? undefined
  }

  if (!match) return false

  // Apply job to all line items for this bill
  await supabase
    .from('bill_line_items')
    .update({ job_id: match.qb_job_id })
    .eq('bill_id', billId)

  await supabase
    .from('bills')
    .update({ status: 'ready', autopublish_hold_reason: null })
    .eq('bill_id', billId)

  console.log(`[ocr] Bill ${billId} job-matched to ${match.qb_job_id}`)
  return true
}

// ---------------------------------------------------------------------------
// PO matching — link bill to matching open PO by PO number
// ---------------------------------------------------------------------------

async function tryMatchPO(
  supabase: SupabaseClient,
  billId: string,
  companyId: string,
  poReference: string,
  billTotal: number,
): Promise<void> {
  const normalised = poReference.trim().toLowerCase()

  const { data: openPOs } = await supabase
    .from('purchase_orders')
    .select('po_id, po_number, total, vendor_name_raw, vendor_id')
    .eq('company_id', companyId)
    .in('status', ['open', 'partially_received'])
    .is('deleted_at', null)

  if (!openPOs || openPOs.length === 0) return

  const match = openPOs.find(
    po => po.po_number?.trim().toLowerCase() === normalised
  )

  if (!match) return

  // Check for dollar discrepancy
  const discrepancy = Math.abs((match.total ?? 0) - billTotal)
  const hasDiscrepancy = discrepancy > 0.01

  await supabase
    .from('bills')
    .update({
      matched_po_id: match.po_id,
      autopublish_hold_reason: hasDiscrepancy
        ? `PO total $${Number(match.total).toFixed(2)} differs from invoice total $${billTotal.toFixed(2)} by $${discrepancy.toFixed(2)}`
        : null,
    })
    .eq('bill_id', billId)

  console.log(`[ocr] Bill ${billId} matched to PO ${match.po_id} (discrepancy: ${hasDiscrepancy})`)
}

// ---------------------------------------------------------------------------
// Rules engine — evaluate a single rule against a line item
// ---------------------------------------------------------------------------

function evaluateRule(
  rule: { match_type: string; conditions: Array<{ field: string; operator: string; value: string }> },
  description: string,
  unitPrice: number,
): boolean {
  const results = rule.conditions.map(cond => {
    const haystack = cond.field === 'description'
      ? description.toLowerCase()
      : String(unitPrice)
    const needle = cond.value.toLowerCase()

    switch (cond.operator) {
      case 'equal':      return haystack === needle
      case 'contains':   return haystack.includes(needle)
      case 'begins_with': return haystack.startsWith(needle)
      case 'ends_with':   return haystack.endsWith(needle)
      default:           return false
    }
  })

  return rule.match_type === 'all'
    ? results.every(Boolean)
    : results.some(Boolean)
}

// ---------------------------------------------------------------------------
// Tiered extraction logic
// ---------------------------------------------------------------------------

function lineItemsMatchTotal(result: TierResult): boolean {
  if (result.total === null || result.line_items.length === 0) return false
  if (result.line_items.some(li => li.total === null)) return false
  const sum = result.line_items.reduce((s, li) => s + (li.total ?? 0), 0)
  return Math.abs(sum - result.total) <= 0.01
}

async function runTieredExtraction(
  pdfBuffer: Buffer,
  opts?: { forceTier?: 2 | 3; userComment?: string }
): Promise<ExtractionResult> {
  const { forceTier, userComment } = opts ?? {}

  // Forced Tier 3 — vision extraction (scanned docs or 2nd+ reprocess)
  if (forceTier === 3) {
    console.log('[ocr] Forced Tier 3 (vision)')
    const tier3 = await extractTier3(pdfBuffer, userComment)
    return { ...tier3, tier: 3 }
  }

  // Tier 1: always extract raw text first
  const tier1 = await extractTier1(pdfBuffer)

  // No text layer → Tier 3 regardless
  if (!hasTextLayer(tier1.rawText)) {
    console.log('[ocr] No text layer detected → Tier 3 (vision)')
    const tier3 = await extractTier3(pdfBuffer, userComment)
    return { ...tier3, tier: 3 }
  }

  // Tier 1 incomplete or line items don't balance → Claude Haiku
  const tier1Incomplete =
    forceTier === 2 ||
    tier1.invoice_number === null ||
    tier1.invoice_date === null ||
    tier1.total === null ||
    !lineItemsMatchTotal(tier1)

  if (tier1Incomplete) {
    const reason = forceTier === 2 ? 'Forced Tier 2' : 'Tier 1 incomplete'
    console.log(`[ocr] ${reason} → Tier 2 (Claude Haiku)`)
    const tier2 = await extractTier2(tier1.rawText, userComment)

    // If Tier 2 also doesn't balance, escalate to Tier 3
    if (!lineItemsMatchTotal(tier2)) {
      console.log('[ocr] Tier 2 line items do not match total → Tier 3 (vision)')
      const tier3 = await extractTier3(pdfBuffer, userComment)
      return { ...tier3, tier: 3 }
    }

    return { ...tier2, tier: 2, raw_text: tier1.rawText }
  }

  // Tier 1 sufficient
  console.log('[ocr] Tier 1 extraction complete')
  return { ...tier1, tier: 1, raw_text: tier1.rawText }
}
