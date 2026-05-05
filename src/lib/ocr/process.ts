import { createClient } from '@supabase/supabase-js'
import { extractTier1, hasTextLayer } from './tier1'
import { extractTier2 } from './tier2'
import { extractTier3 } from './tier3'
import type { ExtractionResult } from './types'

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

  // 4. Update the bill record
  const { error: updateErr } = await supabase
    .from('bills')
    .update({
      status:               'ready',
      vendor_name_raw:      result.vendor_name_raw,
      invoice_number:       result.invoice_number,
      invoice_date:         result.invoice_date,
      due_date:             result.due_date,
      vendor_po_reference:  result.vendor_po_reference,
      total:                result.total,
      subtotal:             result.subtotal,
      tax_amount:           result.tax_amount,
      ocr_tier:             result.tier,
      ocr_confidence:       result.confidence,
    })
    .eq('bill_id', billId)

  if (updateErr) {
    await markOcrError(supabase, billId, `Bill update failed: ${updateErr.message}`)
    return
  }

  // 5. Insert line items (delete any existing first to allow safe re-runs)
  if (result.line_items.length > 0) {
    await supabase.from('bill_line_items').delete().eq('bill_id', billId)

    const { error: lineErr } = await supabase.from('bill_line_items').insert(
      result.line_items.map((li) => ({
        bill_id:       billId,
        company_id:    bill.company_id,
        description:   li.description,
        quantity:      li.quantity,
        unit_cost:     li.unit_price,
        extended_cost: li.total,
        sort_order:    li.sort_order,
      }))
    )

    if (lineErr) {
      console.error(`[ocr] Line items insert failed (${billId}):`, lineErr.message)
    }
  }

  // 6. Append processing log entry
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

  console.log(
    `[ocr] Bill ${billId} processed — tier ${result.tier}, confidence ${result.confidence}, ${result.line_items.length} line items`
  )
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
