import { createClient } from '@supabase/supabase-js'
import { extractTier1, hasTextLayer } from './tier1'
import { extractTier2 } from './tier2'
import { extractTier3 } from './tier3'

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

  // Reuse the same tiered OCR, but interpret as PO
  let rawText = ''
  let tier = 1

  try {
    const tier1 = await extractTier1(pdfBuffer)
    if (!hasTextLayer(tier1.rawText)) {
      const tier3 = await extractTier3(pdfBuffer)
      rawText = tier3.raw_text ?? ''
      tier = 3
    } else if (tier1.invoice_number && tier1.total) {
      rawText = tier1.rawText
      tier = 1
    } else {
      const tier2 = await extractTier2(tier1.rawText)
      rawText = tier1.rawText
      tier = 2
      // Use tier2 extraction for PO fields
      await supabase
        .from('purchase_orders')
        .update({
          vendor_name_raw: tier2.vendor_name_raw,
          po_number:       tier2.invoice_number, // PO number maps to invoice_number field
          order_date:      tier2.invoice_date,
        })
        .eq('po_id', poId)
      await insertPOLineItems(supabase, poId, po.company_id, tier2.line_items)
      return
    }

    // Tier 1 sufficient
    const tier1Data = await extractTier1(pdfBuffer)
    await supabase
      .from('purchase_orders')
      .update({
        vendor_name_raw: tier1Data.vendor_name_raw,
        po_number:       tier1Data.invoice_number,
        order_date:      tier1Data.invoice_date,
      })
      .eq('po_id', poId)

    await insertPOLineItems(supabase, poId, po.company_id, tier1Data.line_items)
  } catch (err) {
    console.error(`[ocr-po] PO extraction failed (${poId}):`, err)
    await supabase
      .from('purchase_orders')
      .update({ qb_sync_error: `Extraction failed: ${err instanceof Error ? err.message : String(err)}` })
      .eq('po_id', poId)
    return
  }

  await supabase.from('processing_log').insert({
    document_id:   poId,
    document_type: 'po',
    company_id:    po.company_id,
    action:        'ocr_complete',
    actor:         'system',
    credits_used:  1,
    after_state:   { tier, status: 'open' },
  })

  console.log(`[ocr-po] PO ${poId} processed (tier ${tier})`)
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
