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
  is_tax_line: boolean | null
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
        gl_account_id, job_id, class_id, is_tax_line, sort_order
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
    .select('default_due_date, push_pdf_to_qb, qb_type')
    .eq('company_id', companyId)
    .single()
  const companyDueDateSetting = companySettings?.default_due_date ?? 'not_required'
  const pushPdfToQb = companySettings?.push_pdf_to_qb ?? true
  const qbType = companySettings?.qb_type ?? 'qbo'

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

    if (lineItems.length === 0) {
      const hasLines = ((bill as Record<string, unknown>).bill_line_items as LineItem[]).length > 0
      if (hasLines) {
        throw new Error('Line items are missing amounts. Enter an amount for each line item on the bill review screen before publishing.')
      }
      throw new Error('No line items found. Add at least one line item with a GL account and amount before publishing.')
    }

    const b = bill as Record<string, unknown>
    const invoiceTotal = b.total as number | null
    if (invoiceTotal != null) {
      const lineSum = lineItems.reduce((s, li) => s + li.extended_cost!, 0)
      if (Math.abs(lineSum - invoiceTotal) > 0.01) {
        throw new Error(
          `Line item total ($${lineSum.toFixed(2)}) does not match invoice total ($${invoiceTotal.toFixed(2)}). Correct the line items before publishing.`
        )
      }
    }

    const isCreditNote = (b.bill_type as string | null) === 'credit_note'

    const qboLines = lineItems.map(li => ({
      DetailType: 'AccountBasedExpenseLineDetail',
      // VendorCredit requires positive amounts; bills can be negative for adjustments
      Amount: isCreditNote ? Math.abs(li.extended_cost!) : li.extended_cost!,
      ...(li.description ? { Description: li.description } : {}),
      AccountBasedExpenseLineDetail: {
        AccountRef: { value: li.gl_account_id! },
        ...(li.job_id ? { CustomerRef: { value: li.job_id } } : {}),
        ...(li.class_id ? { ClassRef: { value: li.class_id } } : {}),
        ...(li.is_tax_line ? { TaxCodeRef: { value: 'TAX' } } : {}),
      },
    }))

    const payload: Record<string, unknown> = {
      Line: qboLines,
      VendorRef: { value: vendor.qb_vendor_id },
    }
    if (b.invoice_date) payload.TxnDate = b.invoice_date

    // VendorCredit has no due date; only set DueDate for regular bills
    if (!isCreditNote) {
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
    }
    // DocNumber = QB "Bill No." field (vendor invoice number), max 21 chars
    const invoiceNum = (b.qb_reference_number as string | null) ?? (b.invoice_number as string | null)
    if (invoiceNum) payload.DocNumber = invoiceNum.slice(0, 21)
    // PrivateNote = QB memo field
    // QBD: description if set, else vendor_po_reference (Ref No. field is limited to 21 chars)
    // QBO: description + job name(s) — job name shows on QB bill list when Memo column is enabled
    let memo: string | null = null
    if (qbType === 'qbo') {
      const uniqueJobIds = [...new Set(lineItems.map(li => li.job_id).filter(Boolean))] as string[]
      let jobLabel: string | null = null
      if (uniqueJobIds.length > 0) {
        const { data: jobRows } = await supabase
          .from('qb_jobs_cache')
          .select('qb_job_id, job_name, customer_name')
          .eq('company_id', companyId)
          .in('qb_job_id', uniqueJobIds)
        if (jobRows?.length) {
          jobLabel = jobRows
            .map(j => [j.customer_name, j.job_name].filter(Boolean).join(': '))
            .filter(Boolean)
            .join(', ')
        }
      }
      const desc = b.description as string | null
      memo = desc && jobLabel ? `${desc} — ${jobLabel}` : jobLabel ?? desc ?? null
    } else {
      memo = (b.description as string | null) || (b.vendor_po_reference as string | null)
    }
    if (memo) payload.PrivateNote = memo

    const endpoint = isCreditNote ? 'vendorcredit' : 'bill'
    const result = await qbPost(endpoint, payload)
    const qbBillId = isCreditNote
      ? (result?.VendorCredit?.Id ?? null)
      : (result?.Bill?.Id ?? null)

    // Attach PDF to QBO bill (QBD cannot receive attachments — see requirements §9.2)
    if (pushPdfToQb && !isCreditNote && qbBillId && b.pdf_url) {
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
      published_at:  new Date().toISOString(),
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
