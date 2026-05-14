import { createClient } from '@supabase/supabase-js'
import { extractTier1, hasTextLayer } from './tier1'
import { extractTier2 } from './tier2'
import { extractTier3 } from './tier3'
import type { ExtractionResult } from './types'
import { sendNotification } from '@/lib/notifications/send-email'

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
  await Promise.all([
    supabase.from('bills').update({ status: 'ocr_error' }).eq('bill_id', billId),
    supabase.from('processing_log').insert({
      bill_id:     billId,
      action:      'ocr_error',
      actor:       'system',
      after_state: { status: 'ocr_error', error },
    }),
  ])
}

// ---------------------------------------------------------------------------
// processBill — entry point called after a bill record is created
// ---------------------------------------------------------------------------

export async function processBill(billId: string): Promise<void> {
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
    result = await runTieredExtraction(pdfBuffer)
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
      event:      'wrong_capture_address',
      subject:    `Duplicate invoice held`,
      body:       `Invoice ${result.invoice_number} from ${result.vendor_name_raw} already exists. The duplicate has been held for review.`,
      billId,
    })
  }

  // 5a. Vendor matching — find vendor by extracted name, link to bill
  let vendorId: string | null = null
  let vendorDefaultGlAccountId: string | null = null
  if (result.vendor_name_raw) {
    const { data: vendor } = await supabase
      .from('vendors')
      .select('vendor_id, billflow_gl_account_id, qb_default_gl_account_id, gl_account_source')
      .eq('company_id', bill.company_id)
      .or(`vendor_name_extracted.ilike.${result.vendor_name_raw},vendor_name_display.ilike.${result.vendor_name_raw}`)
      .limit(1)
      .single()

    if (vendor) {
      vendorId = vendor.vendor_id
      vendorDefaultGlAccountId =
        vendor.billflow_gl_account_id ?? vendor.qb_default_gl_account_id ?? null

      await supabase.from('bills').update({ vendor_id: vendorId }).eq('bill_id', billId)
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
      let glSource: string | null = null

      // 1. Check stored mappings (exact description match)
      const mapping = mappings.find(m => m.description_text.toLowerCase() === desc.toLowerCase())
      if (mapping) {
        glAccountId = mapping.gl_account_id
        glSource = 'mapping'
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

      return {
        bill_id:          billId,
        company_id:       bill.company_id,
        description:      li.description,
        quantity:         li.quantity,
        unit_cost:        li.unit_price,
        extended_cost:    li.total,
        sort_order:       li.sort_order,
        gl_account_id:    glAccountId,
        gl_account_source: glSource,
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

  // 6.5 Deduct 2 credits for the processed bill (only if not a duplicate — duplicates are free)
  if (!isDuplicate) {
    const { data: co } = await supabase
      .from('companies')
      .select('credit_balance')
      .eq('company_id', bill.company_id)
      .single()

    const newBalance = Math.max(0, (co?.credit_balance ?? 0) - 2)
    await Promise.all([
      supabase.from('companies').update({ credit_balance: newBalance }).eq('company_id', bill.company_id),
      supabase.from('credit_ledger').insert({
        company_id:  bill.company_id,
        amount:      -2,
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

async function runTieredExtraction(pdfBuffer: Buffer): Promise<ExtractionResult> {
  // Tier 1: pdf-parse
  const tier1 = await extractTier1(pdfBuffer)

  // No text layer → go straight to Tier 3 (vision)
  if (!hasTextLayer(tier1.rawText)) {
    console.log('[ocr] No text layer detected → Tier 3 (vision)')
    const tier3 = await extractTier3(pdfBuffer)
    return { ...tier3, tier: 3 }
  }

  // Required fields found with good confidence → Tier 1 is sufficient
  if (
    tier1.invoice_number !== null &&
    tier1.invoice_date !== null &&
    tier1.total !== null
  ) {
    console.log('[ocr] Tier 1 extraction complete')
    return { ...tier1, tier: 1, raw_text: tier1.rawText }
  }

  // Tier 2: Claude Haiku with raw text
  console.log('[ocr] Tier 1 incomplete → Tier 2 (Claude Haiku)')
  const tier2 = await extractTier2(tier1.rawText)
  return { ...tier2, tier: 2, raw_text: tier1.rawText }
}
