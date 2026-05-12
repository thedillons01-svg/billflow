import { createServiceClient } from '@/lib/supabase/service'
import { getQBClient } from './client'

type LineItem = {
  line_id: string
  description: string | null
  quantity: number | null
  unit_cost: number | null
  extended_cost: number | null
  gl_account_id: string | null
  job_id: string | null
  class_id: string | null
  sort_order: number
}

type Vendor = {
  qb_vendor_id: string | null
  copy_po_to_qb_reference: boolean
}

export async function pushBillToQBO(billId: string, companyId: string): Promise<void> {
  const supabase = createServiceClient()

  const { data: bill, error } = await supabase
    .from('bills')
    .select(`
      bill_id, invoice_number, invoice_date, due_date, total,
      vendor_po_reference, qb_reference_number,
      vendor_id,
      vendors!bills_vendor_id_fkey (
        qb_vendor_id, copy_po_to_qb_reference
      ),
      bill_line_items (
        line_id, description, quantity, unit_cost, extended_cost,
        gl_account_id, job_id, class_id, sort_order
      )
    `)
    .eq('bill_id', billId)
    .eq('company_id', companyId)
    .single()

  if (error || !bill) throw new Error('Bill not found')

  const vendor = (bill as Record<string, unknown>).vendors as Vendor | null
  if (!vendor?.qb_vendor_id) throw new Error('Vendor not linked to QuickBooks — set the QB vendor on the vendor record first.')

  await supabase.from('bills').update({ status: 'publishing', qb_sync_error: null }).eq('bill_id', billId)

  try {
    const { qbPost } = await getQBClient(companyId)

    const lineItems = ((bill as Record<string, unknown>).bill_line_items as LineItem[])
      .sort((a, b) => a.sort_order - b.sort_order)
      .filter(li => li.gl_account_id != null && li.extended_cost != null)

    if (lineItems.length === 0) throw new Error('No line items with GL accounts to push.')

    const qboLines = lineItems.map(li => ({
      DetailType: 'AccountBasedExpenseLineDetail',
      Amount: li.extended_cost!,
      ...(li.description ? { Description: li.description } : {}),
      AccountBasedExpenseLineDetail: {
        AccountRef: { value: li.gl_account_id! },
        ...(li.job_id ? { CustomerRef: { value: li.job_id } } : {}),
        ...(li.class_id ? { ClassRef: { value: li.class_id } } : {}),
      },
    }))

    const refNumber = vendor.copy_po_to_qb_reference
      ? ((bill as Record<string, unknown>).qb_reference_number ?? (bill as Record<string, unknown>).vendor_po_reference ?? undefined)
      : ((bill as Record<string, unknown>).qb_reference_number ?? undefined)

    const payload: Record<string, unknown> = {
      Line: qboLines,
      VendorRef: { value: vendor.qb_vendor_id },
    }
    if ((bill as Record<string, unknown>).invoice_date) payload.TxnDate = (bill as Record<string, unknown>).invoice_date
    if ((bill as Record<string, unknown>).due_date) payload.DueDate = (bill as Record<string, unknown>).due_date
    if ((bill as Record<string, unknown>).invoice_number) payload.DocNumber = (bill as Record<string, unknown>).invoice_number
    if (refNumber) payload.PrivateNote = refNumber

    const result = await qbPost('bill', payload)
    const qbBillId = result?.Bill?.Id ?? null

    await supabase.from('bills').update({
      status: 'published',
      qb_bill_id: qbBillId,
      publish_method: 'manual',
      qb_sync_error: null,
    }).eq('bill_id', billId)

    await supabase.from('processing_log').insert({
      bill_id: billId,
      company_id: companyId,
      action: 'published_to_qbo',
      actor: 'system',
      after_state: { qb_bill_id: qbBillId },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await supabase.from('bills').update({
      status: 'sync_error',
      qb_sync_error: message,
    }).eq('bill_id', billId)
    throw err
  }
}
