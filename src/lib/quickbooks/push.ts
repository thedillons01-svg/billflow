import { createServiceClient } from '@/lib/supabase/service'
import { getQBClient } from './client'
import { sendNotification } from '@/lib/notifications/send-email'

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
      bill_id, invoice_number, invoice_date, due_date, total, description,
      vendor_po_reference, qb_reference_number,
      mark_as_paid, payment_account_id, payment_method, payment_date, payment_ref_number,
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
  if (!vendor?.qb_vendor_id) {
    throw new Error('Vendor not linked to QuickBooks — set the QB vendor on the vendor record first.')
  }

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

    const b = bill as Record<string, unknown>
    const refNumber = vendor.copy_po_to_qb_reference
      ? (b.qb_reference_number ?? b.vendor_po_reference ?? undefined)
      : (b.qb_reference_number ?? undefined)

    const payload: Record<string, unknown> = {
      Line: qboLines,
      VendorRef: { value: vendor.qb_vendor_id },
    }
    if (b.invoice_date) payload.TxnDate = b.invoice_date
    if (b.due_date) payload.DueDate = b.due_date
    if (b.invoice_number) payload.DocNumber = b.invoice_number
    if (b.description) payload.PrivateNote = b.description
    if (refNumber) payload.CustomField = [{ Name: 'RefNumber', StringValue: refNumber }]

    const result = await qbPost('bill', payload)
    const qbBillId = result?.Bill?.Id ?? null

    // Step 12: Mark as Paid — create a linked bill payment if enabled
    let qbPaymentId: string | null = null
    if (b.mark_as_paid && b.payment_account_id && qbBillId) {
      try {
        const paymentPayload: Record<string, unknown> = {
          VendorRef: { value: vendor.qb_vendor_id },
          TotalAmt: b.total,
          PayType: 'Check',
          CheckPayment: {
            BankAccountRef: { value: b.payment_account_id },
          },
          Line: [{
            Amount: b.total,
            LinkedTxn: [{ TxnId: qbBillId, TxnType: 'Bill' }],
          }],
        }
        if (b.payment_date) paymentPayload.TxnDate = b.payment_date
        if (b.payment_ref_number) {
          paymentPayload.CheckPayment = {
            ...(paymentPayload.CheckPayment as object),
            CheckNum: b.payment_ref_number,
          }
        }

        const payResult = await qbPost('billpayment', paymentPayload)
        qbPaymentId = payResult?.BillPayment?.Id ?? null
      } catch (payErr) {
        // Payment creation failure shouldn't block the bill from being marked published
        console.error(`[push] Bill payment failed for ${billId}:`, payErr)
      }
    }

    await supabase.from('bills').update({
      status:         'published',
      qb_bill_id:     qbBillId,
      qb_payment_id:  qbPaymentId,
      publish_method: 'manual',
      qb_sync_error:  null,
    }).eq('bill_id', billId)

    await supabase.from('processing_log').insert({
      bill_id:       billId,
      company_id:    companyId,
      document_type: 'bill',
      credits_used:  2,
      action:        'published_to_qbo',
      actor:         'system',
      after_state:   { qb_bill_id: qbBillId, qb_payment_id: qbPaymentId },
    })

    await sendNotification({
      companyId,
      event:   'bill_auto_published',
      subject: 'Bill published to QuickBooks',
      body:    `Bill ${(bill as Record<string, unknown>).invoice_number ?? billId} was successfully pushed to QuickBooks.`,
      billId,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await supabase.from('bills').update({
      status:        'sync_error',
      qb_sync_error: message,
    }).eq('bill_id', billId)

    await sendNotification({
      companyId,
      event:   'bill_sync_error',
      subject: 'QuickBooks sync error',
      body:    `Bill ${billId} failed to sync to QuickBooks: ${message}`,
      billId,
    })
    throw err
  }
}
