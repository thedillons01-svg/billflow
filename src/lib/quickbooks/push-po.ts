import { createServiceClient } from '@/lib/supabase/service'
import { getQBClient } from './client'
import { sendNotification } from '@/lib/notifications/send-email'

export async function pushPOToQBO(poId: string, companyId: string): Promise<void> {
  const supabase = createServiceClient()

  const { data: po } = await supabase
    .from('purchase_orders')
    .select(`
      po_id, po_number, order_date, expected_delivery_date, job_id,
      vendor_id,
      vendors!purchase_orders_vendor_id_fkey(qb_vendor_id, billflow_gl_account_id, qb_default_gl_account_id),
      po_line_items(line_id, description, quantity_ordered, unit_cost, extended_cost, sort_order)
    `)
    .eq('po_id', poId)
    .eq('company_id', companyId)
    .single()

  if (!po) throw new Error('PO not found')

  const vendor = (po as Record<string, unknown>).vendors as {
    qb_vendor_id: string | null
    billflow_gl_account_id: string | null
    qb_default_gl_account_id: string | null
  } | null
  if (!vendor?.qb_vendor_id) throw new Error('Vendor not linked to QuickBooks.')

  const vendorGl = vendor.billflow_gl_account_id ?? vendor.qb_default_gl_account_id ?? null
  if (!vendorGl) {
    throw new Error(
      'Cannot push to QuickBooks: no default GL account set on this vendor. ' +
      'Set a default expense account on the vendor record in Purchasomatic and try again.'
    )
  }

  const lines = ((po as Record<string, unknown>).po_line_items as {
    line_id:          string
    description:      string | null
    quantity_ordered: number | null
    unit_cost:        number | null
    extended_cost:    number | null
    sort_order:       number
  }[]).sort((a, b) => a.sort_order - b.sort_order)

  if (lines.length === 0) {
    throw new Error('Cannot push to QuickBooks: this PO has no line items.')
  }

  try {
    const { qbPost } = await getQBClient(companyId)

    const qboLines = lines.map(l => {
      const amount = l.extended_cost != null
        ? Number(l.extended_cost)
        : (Number(l.quantity_ordered ?? 1) * Number(l.unit_cost ?? 0))
      return {
        DetailType: 'AccountBasedExpenseLineDetail',
        Amount: Math.max(0, amount),
        ...(l.description ? { Description: l.description } : {}),
        AccountBasedExpenseLineDetail: {
          AccountRef: { value: String(vendorGl) },
          ...(po.job_id ? { CustomerRef: { value: String(po.job_id) } } : {}),
        },
      }
    })

    const payload: Record<string, unknown> = {
      Line: qboLines,
      VendorRef: { value: String(vendor.qb_vendor_id) },
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
      credits_used:  0,
      after_state:   { qb_po_id: qbPoId },
    })

    await sendNotification({
      companyId,
      event:   'po_processed',
      subject: 'Purchase order sent to QuickBooks',
      body:    `PO ${(po as Record<string, unknown>).po_number ?? poId} was successfully pushed to QuickBooks.`,
      poId,
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
