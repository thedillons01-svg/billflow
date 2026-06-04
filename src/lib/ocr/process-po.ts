import { createClient } from '@supabase/supabase-js'
import { extractTier1, hasTextLayer } from './tier1'
import { extractTier2 } from './tier2'
import { extractTier3 } from './tier3'
import type { ExtractionResult } from './types'
import { sendNotification } from '@/lib/notifications/send-email'
import { syncVendorsIfStale, syncJobsIfStale } from '@/lib/quickbooks/sync'
import { saveToStorage } from '@/lib/storage/save-to-storage'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const STORAGE_BUCKET = 'bill-pdfs'

type SupabaseClient = ReturnType<typeof getServiceClient>

export async function processPO(poId: string): Promise<void> {
  const supabase = getServiceClient()

  const { data: po } = await supabase
    .from('purchase_orders')
    .select('po_id, company_id, pdf_url, status')
    .eq('po_id', poId)
    .single()

  if (!po) {
    console.error(`[ocr-po] PO not found (${poId})`)
    return
  }

  // Skip if already processed (e.g. duplicate trigger)
  if (po.status !== 'open') {
    console.warn(`[ocr-po] Skipping PO ${poId} — status is ${po.status}, expected open`)
    return
  }

  const { data: fileData, error: downloadErr } = await supabase.storage
    .from(STORAGE_BUCKET)
    .download(po.pdf_url)

  if (downloadErr || !fileData) {
    const msg = `PDF download failed: ${downloadErr?.message ?? 'no data'}`
    console.error(`[ocr-po] ${poId}: ${msg}`)
    await supabase.from('purchase_orders').update({ qb_sync_error: msg }).eq('po_id', poId)
    return
  }

  const pdfBuffer = Buffer.from(await fileData.arrayBuffer())

  let result: ExtractionResult
  let tier: number

  try {
    const extracted = await runTieredExtraction(pdfBuffer)
    result = extracted.result
    tier = extracted.tier
  } catch (err) {
    const msg = `Extraction failed: ${err instanceof Error ? err.message : String(err)}`
    console.error(`[ocr-po] PO extraction failed (${poId}):`, err)
    await supabase.from('purchase_orders').update({ qb_sync_error: msg }).eq('po_id', poId)
    return
  }

  // Update PO with extracted fields
  await supabase
    .from('purchase_orders')
    .update({
      vendor_name_raw: result.vendor_name_raw,
      po_number:       result.invoice_number,   // invoice_number field maps to PO number
      order_date:      result.invoice_date,
    })
    .eq('po_id', poId)

  // Refresh vendor cache from QB if stale
  await syncVendorsIfStale(po.company_id)

  // Vendor matching — find existing vendor or create from QB cache match
  if (result.vendor_name_raw) {
    const { data: vendor } = await supabase
      .from('vendors')
      .select('vendor_id')
      .eq('company_id', po.company_id)
      .or(`vendor_name_extracted.ilike.${result.vendor_name_raw},vendor_name_display.ilike.${result.vendor_name_raw}`)
      .limit(1)
      .single()

    if (vendor) {
      await supabase.from('purchase_orders').update({ vendor_id: vendor.vendor_id }).eq('po_id', poId)
    } else {
      // New vendor — try to match from QB cache first
      const { data: qbMatch } = await supabase
        .from('qb_vendors_cache')
        .select('qb_vendor_id, name, default_expense_account_id, payment_terms')
        .eq('company_id', po.company_id)
        .ilike('name', `%${result.vendor_name_raw}%`)
        .limit(1)
        .single()

      if (qbMatch) {
        const { data: created } = await supabase
          .from('vendors')
          .insert({
            company_id:               po.company_id,
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
            invoices_processed:       0,
          })
          .select('vendor_id')
          .single()

        if (created) {
          await supabase.from('purchase_orders').update({ vendor_id: created.vendor_id }).eq('po_id', poId)
        }
      } else {
        console.log(`[ocr-po] No QB cache match for "${result.vendor_name_raw}" (${poId}) — leaving unmatched`)
      }
    }
  }

  // Job matching — try vendor_po_reference first, supplement with job_name_extracted
  const jobMatchRef = result.vendor_po_reference ?? result.job_name_extracted
  if (jobMatchRef) {
    await tryMatchJobForPO(supabase, poId, po.company_id, jobMatchRef, result.job_name_extracted ?? undefined)
  }

  // Insert PO line items
  await insertPOLineItems(supabase, poId, po.company_id, result.line_items, result.tax_amount)

  // Deduct 1 credit for PO processing
  const { data: co } = await supabase
    .from('companies')
    .select('credit_balance')
    .eq('company_id', po.company_id)
    .single()

  const newBalance = Math.max(0, (co?.credit_balance ?? 0) - 1)
  await Promise.all([
    supabase.from('companies').update({ credit_balance: newBalance }).eq('company_id', po.company_id),
    supabase.from('credit_ledger').insert({
      company_id:  po.company_id,
      amount:      -1,
      description: `PO processed: ${result.vendor_name_raw ?? 'Unknown'} ${result.invoice_number ?? ''}`.trim(),
    }),
  ])

  await supabase.from('processing_log').insert({
    document_id:   poId,
    document_type: 'po',
    company_id:    po.company_id,
    action:        'ocr_complete',
    actor:         'system',
    credits_used:  1,
    after_state:   { tier, status: 'open', po_number: result.invoice_number },
  })

  console.log(`[ocr-po] PO ${poId} processed — tier ${tier}, ${result.line_items.length} line items`)

  // Send success notification
  await sendNotification({
    companyId:  po.company_id,
    event:      'po_processed',
    subject:    `PO processed: ${result.vendor_name_raw ?? 'Unknown vendor'}`,
    body:       `Purchase order ${result.invoice_number ?? '(no number)'} from ${result.vendor_name_raw ?? 'Unknown vendor'} was captured and is ready for review.`,
  })

  // Save to external storage (SFTP / Google Drive) if configured
  try {
    await saveToStorage(poId, 'po', po.company_id)
  } catch (err) {
    console.error(`[ocr-po] saveToStorage failed for PO ${poId}:`, err)
  }
}

// ---------------------------------------------------------------------------
// Job matching — same fuzzy logic as bill processing, but updates PO header
// ---------------------------------------------------------------------------

function extractJobCandidates(poReference: string): string[] {
  const raw = poReference.trim().toLowerCase()
  const candidates = new Set<string>([raw])

  const stripped = raw
    .replace(/^(job\s*[#\-]?\s*(no\.?\s*)?|work\s*order\s*[#\-]?\s*|wo\s*[#\-]?\s*|p\.?o\.?\s*[#\-]?\s*(no\.?\s*)?|order\s*[#\-]?\s*(no\.?\s*)?|ref\.?\s*[#:\-]?\s*|ticket\s*[#\-]?\s*|#\s*)/, '')
    .trim()
  if (stripped && stripped !== raw) candidates.add(stripped)

  const numbers = raw.match(/\b\d{4,}\b/g) ?? []
  for (const n of numbers) candidates.add(n)

  return [...candidates].filter(Boolean)
}

function jobMatchesCandidates(
  job: { qb_job_id: string; job_number: string | null; job_name: string | null },
  candidates: string[]
): boolean {
  const num  = job.job_number?.trim().toLowerCase()
  const name = job.job_name?.trim().toLowerCase()
  for (const c of candidates) {
    if (num === c || name === c) return true
    if (num && num.length >= 4 && c.includes(num)) return true
    if (name && name.length >= 4 && (c.includes(name) || name.includes(c))) return true
  }
  return false
}

async function tryMatchJobForPO(
  supabase: SupabaseClient,
  poId: string,
  companyId: string,
  poReference: string,
  jobNameExtracted?: string,
): Promise<void> {
  const candidates = [
    ...extractJobCandidates(poReference),
    ...(jobNameExtracted ? extractJobCandidates(jobNameExtracted) : []),
  ]

  const { data: jobs } = await supabase
    .from('qb_jobs_cache')
    .select('qb_job_id, job_number, job_name')
    .eq('company_id', companyId)

  let match = (jobs ?? []).find(j => jobMatchesCandidates(j, candidates))

  // Cache miss — refresh from QB then retry once
  if (!match) {
    await syncJobsIfStale(companyId)
    const { data: freshJobs } = await supabase
      .from('qb_jobs_cache')
      .select('qb_job_id, job_number, job_name')
      .eq('company_id', companyId)
    match = (freshJobs ?? []).find(j => jobMatchesCandidates(j, candidates))
  }

  if (!match) return

  await supabase
    .from('purchase_orders')
    .update({ job_id: match.qb_job_id })
    .eq('po_id', poId)

  console.log(`[ocr-po] PO ${poId} job-matched to ${match.qb_job_id}`)
}

// ---------------------------------------------------------------------------
// Tiered extraction — Tier 1 → Tier 2 → Tier 3 with PO-specific logic
// ---------------------------------------------------------------------------

async function runTieredExtraction(pdfBuffer: Buffer): Promise<{ result: ExtractionResult; tier: number }> {
  const tier1 = await extractTier1(pdfBuffer)

  // No text layer → Tier 3 (vision)
  if (!hasTextLayer(tier1.rawText)) {
    console.log('[ocr-po] No text layer → Tier 3 (vision)')
    const tier3 = await extractTier3(pdfBuffer, undefined, 'po')
    return { result: { ...tier3, tier: 3 }, tier: 3 }
  }

  // For POs we don't require line items to balance to a total — POs often omit extended costs.
  // Escalate Tier 1→2 only if key header fields are missing or no line items found at all.
  const tier1Incomplete =
    tier1.invoice_number === null ||
    tier1.invoice_date === null ||
    tier1.line_items.length === 0

  if (tier1Incomplete) {
    console.log('[ocr-po] Tier 1 incomplete → Tier 2 (Claude Haiku)')
    const tier2 = await extractTier2(tier1.rawText, undefined, 'po')

    // Escalate Tier 2→3 only if still no line items
    if (tier2.line_items.length === 0) {
      console.log('[ocr-po] Tier 2 found no line items → Tier 3 (vision)')
      const tier3 = await extractTier3(pdfBuffer, undefined, 'po')
      return { result: { ...tier3, tier: 3 }, tier: 3 }
    }

    return { result: { ...tier2, tier: 2, raw_text: tier1.rawText }, tier: 2 }
  }

  console.log('[ocr-po] Tier 1 extraction complete')
  return { result: { ...tier1, tier: 1, raw_text: tier1.rawText }, tier: 1 }
}

// ---------------------------------------------------------------------------
// PO line item insertion — no GL account on PO lines
// ---------------------------------------------------------------------------

type LineItem = {
  description?: string | null
  quantity?: number | null
  unit_price?: number | null
  total?: number | null
  sort_order?: number
}

const TAX_KEYWORDS = ['sales tax', 'tax', 'hst', 'gst', 'pst', 'qst', 'vat', 'excise tax']

function isTaxDescription(desc: string | null | undefined): boolean {
  if (!desc) return false
  const d = desc.toLowerCase().trim()
  return TAX_KEYWORDS.some(kw => d === kw || d.startsWith(kw + ' ') || d.endsWith(' ' + kw))
}

async function insertPOLineItems(
  supabase: SupabaseClient,
  poId: string,
  companyId: string,
  lineItems: LineItem[],
  taxAmount?: number | null
) {
  // Synthesize a tax line from tax_amount if the OCR captured tax as a scalar
  // and no line item already has a tax description
  const allItems = [...lineItems]
  const hasTaxLine = allItems.some(li => isTaxDescription(li.description))
  if (!hasTaxLine && taxAmount && taxAmount > 0) {
    allItems.push({
      description: 'Tax',
      quantity:    null,
      unit_price:  null,
      total:       taxAmount,
      sort_order:  allItems.length,
    })
  }

  if (!allItems.length) return
  await supabase.from('po_line_items').delete().eq('po_id', poId)
  await supabase.from('po_line_items').insert(
    allItems.map((li, i) => ({
      po_id:            poId,
      company_id:       companyId,
      description:      li.description ?? null,
      quantity_ordered: li.quantity ?? null,
      unit_cost:        li.unit_price ?? null,
      extended_cost:    li.total ?? null,
      is_tax_line:      isTaxDescription(li.description),
      sort_order:       li.sort_order ?? i,
    }))
  )
}
