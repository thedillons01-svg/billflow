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
      vendor_po_reference, qb_reference_number, bill_type,
      mark_as_paid, payment_account_id, payment_method, payment_date, payment_ref_number,
      vendor_id, matched_po_id,
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

  const { data: companySettings } = await supabase
    .from('companies')
    .select('qb_ref_source, default_due_date')
    .eq('company_id', companyId)
    .single()
  const qbRefSource = companySettings?.qb_ref_source ?? 'po_number'
  const companyDueDateSetting = companySettings?.default_due_date ?? 'not_required'

  // Fetch vendor's due date override
  const { data: vendorSettings } = bill.vendor_id ? await supabase
    .from('vendors')
    .select('default_due_date, billflow_payment_terms, qb_payment_terms')
    .eq('vendor_id', bill.vendor_id as string)
    .single() : { data: null }
  const vendorDueDateSetting = vendorSettings?.default_due_date && vendorSettings.default_due_date !== 'not_set'
    ? vendorSettings.default_due_date
    : companyDueDateSetting

  await supabase.from('bills').update({ status: 'publishing', qb_sync_error: null }).eq('bill_id', billId)

  try {
    const { qbPost, qbUpload } = await getQBClient(companyId)

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
    // Compute QB Ref No: vendor flag copy_po_to_qb_reference overrides company qb_ref_source setting
    let refNumber: string | undefined
    if (vendor.copy_po_to_qb_reference) {
      refNumber = (b.qb_reference_number as string | null) ?? (b.vendor_po_reference as string | null) ?? undefined
    } else if (qbRefSource === 'invoice_number') {
      refNumber = (b.qb_reference_number as string | null) ?? (b.invoice_number as string | null) ?? undefined
    } else if (qbRefSource === 'po_number') {
      refNumber = (b.qb_reference_number as string | null) ?? (b.vendor_po_reference as string | null) ?? undefined
    } else {
      refNumber = (b.qb_reference_number as string | null) ?? undefined
    }

    const payload: Record<string, unknown> = {
      Line: qboLines,
      VendorRef: { value: vendor.qb_vendor_id },
    }
    if (b.invoice_date) payload.TxnDate = b.invoice_date

    // Apply due date: use explicit bill due_date first, then fall back to vendor/company setting
    if (b.due_date) {
      payload.DueDate = b.due_date
    } else if (vendorDueDateSetting === 'same_as_invoice_date' && b.invoice_date) {
      payload.DueDate = b.invoice_date
    } else if (vendorDueDateSetting === 'from_payment_terms') {
      const terms = vendorSettings?.billflow_payment_terms ?? vendorSettings?.qb_payment_terms ?? null
      const termDays = terms ? parseInt(terms.replace(/\D/g, ''), 10) : NaN
      if (b.invoice_date && !isNaN(termDays) && termDays > 0) {
        const due = new Date(b.invoice_date as string)
        due.setDate(due.getDate() + termDays)
        payload.DueDate = due.toISOString().slice(0, 10)
      }
    }
    // DocNumber is the QB "Ref No." field — max 21 chars enforced by QBO
    if (refNumber) payload.DocNumber = refNumber.slice(0, 21)
    if (b.description) payload.PrivateNote = b.description

    const isCreditNote = b.bill_type === 'credit_note'
    const endpoint = isCreditNote ? 'vendorcredit' : 'bill'
    const result = await qbPost(endpoint, payload)
    const qbBillId = isCreditNote
      ? (result?.VendorCredit?.Id ?? null)
      : (result?.Bill?.Id ?? null)

    // Attach PDF to QBO bill (QBD cannot receive attachments — see requirements §9.2)
    if (!isCreditNote && qbBillId && b.pdf_url) {
      try {
        const { data: pdfBlob } = await supabase.storage.from('bill-pdfs').download(b.pdf_url as string)
        if (pdfBlob) {
          const arrayBuffer = await pdfBlob.arrayBuffer()
          await qbUpload('Bill', qbBillId, Buffer.from(arrayBuffer), `invoice-${bill.invoice_number ?? billId}.pdf`)
        }
      } catch (attachErr) {
        console.error(`[push] PDF attachment failed for ${billId}:`, attachErr)
      }
    }

    // Step 12: Mark as Paid — create a linked bill payment if enabled (bills only, not vendor credits)
    let qbPaymentId: string | null = null
    if (!isCreditNote && b.mark_as_paid && b.payment_account_id && qbBillId) {
      try {
        const isCreditCard = b.payment_method === 'credit_card'
        const paymentPayload: Record<string, unknown> = {
          VendorRef: { value: vendor.qb_vendor_id },
          TotalAmt: b.total,
          PayType: isCreditCard ? 'CreditCard' : 'Check',
          Line: [{
            Amount: b.total,
            LinkedTxn: [{ TxnId: qbBillId, TxnType: 'Bill' }],
          }],
        }
        if (isCreditCard) {
          paymentPayload.CreditCardPayment = { CCAccountRef: { value: b.payment_account_id } }
        } else {
          paymentPayload.CheckPayment = { BankAccountRef: { value: b.payment_account_id } }
          if (b.payment_ref_number) {
            paymentPayload.CheckPayment = {
              ...(paymentPayload.CheckPayment as object),
              CheckNum: b.payment_ref_number,
            }
          }
        }
        if (b.payment_date) paymentPayload.TxnDate = b.payment_date

        const payResult = await qbPost('billpayment', paymentPayload)
        qbPaymentId = payResult?.BillPayment?.Id ?? null
      } catch (payErr) {
        // Payment creation failure shouldn't block the bill from being marked published
        console.error(`[push] Bill payment failed for ${billId}:`, payErr)
      }
    }

    await supabase.from('bills').update({
      status:        'published',
      qb_bill_id:    qbBillId,
      qb_payment_id: qbPaymentId,
      qb_sync_error: null,
    }).eq('bill_id', billId)

    // Update matched PO status when bill publishes
    const matchedPoId = (b.matched_po_id as string | null)
    if (matchedPoId) {
      const { data: poLines } = await supabase
        .from('po_line_items')
        .select('quantity_ordered, quantity_received')
        .eq('po_id', matchedPoId)
      if (poLines && poLines.length > 0) {
        const allReceived = poLines.every(l => (l.quantity_received ?? 0) >= (l.quantity_ordered ?? 0))
        const anyReceived = poLines.some(l => (l.quantity_received ?? 0) > 0)
        const newPoStatus = allReceived ? 'received' : anyReceived ? 'partially_received' : 'partially_received'
        await supabase.from('purchase_orders').update({ status: newPoStatus }).eq('po_id', matchedPoId)
      }
    }

    await supabase.from('processing_log').insert({
      bill_id:       billId,
      company_id:    companyId,
      document_type: 'bill',
      credits_used:  0,
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

    // Update vendor confidence score based on last 20 published bills
    const billVendorId = (bill as Record<string, unknown>).vendor_id as string | null
    if (billVendorId) {
      const { data: recentPublished } = await supabase
        .from('bills')
        .select('publish_method')
        .eq('vendor_id', billVendorId)
        .eq('company_id', companyId)
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .limit(20)
      if (recentPublished && recentPublished.length > 0) {
        const autoCount = recentPublished.filter(b => b.publish_method === 'auto').length
        const ratio = autoCount / recentPublished.length
        const score = Math.round(ratio * 100) / 100
        const display = ratio >= 0.8 ? 'high' : ratio >= 0.5 ? 'medium' : 'low'
        await supabase.from('vendors')
          .update({ confidence_score: score, confidence_display: display })
          .eq('vendor_id', billVendorId)
      }
    }
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
