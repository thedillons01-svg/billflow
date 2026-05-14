import { createClient } from '@supabase/supabase-js'
import { extractTier1, hasTextLayer } from './tier1'
import { extractTier2 } from './tier2'
import { extractTier3 } from './tier3'
import type { ExtractionResult } from './types'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const STORAGE_BUCKET = 'bill-pdfs'

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

  const { data: fileData } = await supabase.storage
    .from(STORAGE_BUCKET)
    .download(po.pdf_url)

  if (!fileData) {
    await supabase.from('purchase_orders').update({ qb_sync_error: 'PDF download failed' }).eq('po_id', poId)
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
    console.error(`[ocr-po] PO extraction failed (${poId}):`, err)
    await supabase
      .from('purchase_orders')
      .update({ qb_sync_error: `Extraction failed: ${err instanceof Error ? err.message : String(err)}` })
      .eq('po_id', poId)
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

  // Vendor matching — find vendor by extracted name
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
    }
  }

  // Insert PO line items
  await insertPOLineItems(supabase, poId, po.company_id, result.line_items)

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
}

async function runTieredExtraction(pdfBuffer: Buffer): Promise<{ result: ExtractionResult; tier: number }> {
  const tier1 = await extractTier1(pdfBuffer)

  if (!hasTextLayer(tier1.rawText)) {
    console.log('[ocr-po] No text layer → Tier 3 (vision)')
    const tier3 = await extractTier3(pdfBuffer)
    return { result: { ...tier3, tier: 3 }, tier: 3 }
  }

  if (tier1.invoice_number !== null && tier1.total !== null) {
    console.log('[ocr-po] Tier 1 extraction complete')
    return { result: { ...tier1, tier: 1, raw_text: tier1.rawText }, tier: 1 }
  }

  console.log('[ocr-po] Tier 1 incomplete → Tier 2 (Claude Haiku)')
  const tier2 = await extractTier2(tier1.rawText)
  return { result: { ...tier2, tier: 2, raw_text: tier1.rawText }, tier: 2 }
}

type LineItem = {
  description?: string | null
  quantity?: number | null
  unit_price?: number | null
  total?: number | null
  sort_order?: number
}

async function insertPOLineItems(
  supabase: ReturnType<typeof getServiceClient>,
  poId: string,
  companyId: string,
  lineItems: LineItem[]
) {
  if (!lineItems.length) return
  await supabase.from('po_line_items').delete().eq('po_id', poId)
  await supabase.from('po_line_items').insert(
    lineItems.map((li, i) => ({
      po_id:            poId,
      company_id:       companyId,
      description:      li.description ?? null,
      quantity_ordered: li.quantity ?? null,
      unit_cost:        li.unit_price ?? null,
      extended_cost:    li.total ?? null,
      sort_order:       li.sort_order ?? i,
    }))
  )
}
