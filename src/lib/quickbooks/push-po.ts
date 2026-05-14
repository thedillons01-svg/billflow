import { createServiceClient } from '@/lib/supabase/service'
import { getQBClient } from './client'

export async function pushPOToQBO(poId: string, companyId: string): Promise<void> {
  const supabase = createServiceClient()

  const { data: po } = await supabase
    .from('purchase_orders')
    .select(`
      po_id, po_number, order_date, expected_delivery_date, job_id,
      vendor_id,
      vendors!purchase_orders_vendor_id_fkey(qb_vendor_id),
      po_line_items(line_id, description, quantity_ordered, unit_cost, extended_cost, gl_account_id, sort_order)
    `)
    .eq('po_id', poId)
    .eq('company_id', companyId)
    .single()

  if (!po) throw new Error('PO not found')

  const vendor = (po as Record<string, unknown>).vendors as { qb_vendor_id: string | null } | null
  if (!vendor?.qb_vendor_id) throw new Error('Vendor not linked to QuickBooks.')

  const lines = ((po as Record<string, unknown>).po_line_items as {
    line_id: string
    description: string | null
    quantity_ordered: number | null
    unit_cost: number | null
    extended_cost: number | null
    gl_account_id: string | null
    sort_order: number
  }[]).sort((a, b) => a.sort_order - b.sort_order)

  try {
    const { qbPost } = await getQBClient(companyId)

    const qboLines = lines
      .filter(l => l.gl_account_id && l.extended_cost != null)
      .map(l => ({
        DetailType: 'AccountBasedExpenseLineDetail',
        Amount: l.extended_cost!,
        ...(l.description ? { Description: l.description } : {}),
        AccountBasedExpenseLineDetail: {
          AccountRef: { value: l.gl_account_id! },
          Qty: l.quantity_ordered ?? 1,
          UnitPrice: l.unit_cost ?? undefined,
          ...(po.job_id ? { CustomerRef: { value: po.job_id } } : {}),
        },
      }))

    const payload: Record<string, unknown> = {
      Line: qboLines,
      VendorRef: { value: vendor.qb_vendor_id },
    }
    if (po.po_number) payload.DocNumber = po.po_number
    if (po.order_date) payload.TxnDate = po.order_date
    if (po.expected_delivery_date) payload.ShipDate = po.expected_delivery_date

    const result = await qbPost('purchaseorder', payload)
    const qbPoId = result?.PurchaseOrder?.Id ?? null

    await supabase
      .from('purchase_orders')
      .update({ qb_po_id: qbPoId, qb_sync_error: null })
      .eq('po_id', poId)

    await supabase.from('processing_log').insert({
      document_id:   poId,
      document_type: 'po',
      company_id:    companyId,
      action:        'published_to_qbo',
      actor:         'system',
      credits_used:  1,
      after_state:   { qb_po_id: qbPoId },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await supabase
      .from('purchase_orders')
      .update({ qb_sync_error: message })
      .eq('po_id', poId)
    throw err
  }
}
