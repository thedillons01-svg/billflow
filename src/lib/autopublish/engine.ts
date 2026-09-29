import { createServiceClient } from '@/lib/supabase/service'
import { pushBillToQBO } from '@/lib/quickbooks/push'
import { sendNotification } from '@/lib/notifications/send-email'

type EligibilityResult = { eligible: true } | { eligible: false; reason: string }

export async function checkAutopublishEligibility(billId: string, companyId: string): Promise<EligibilityResult> {
  const supabase = createServiceClient()

  const { data: bill } = await supabase
    .from('bills')
    .select(`
      bill_id, invoice_number, invoice_date, total, line_items_total, vendor_id,
      mark_as_paid, payment_account_id, matched_po_id, autopublish_hold_reason,
      bill_line_items ( line_id, gl_account_id, job_id, extended_cost ),
      vendors!bills_vendor_id_fkey (
        vendor_id, auto_publish_enabled, hold_for_job_match,
        invoices_processed, qb_vendor_id, gl_account_source,
        billflow_gl_account_id, qb_default_gl_account_id,
        mark_as_paid_default, default_payment_account_id
      )
    `)
    .eq('bill_id', billId)
    .eq('company_id', companyId)
    .single()

  if (!bill) return { eligible: false, reason: 'Bill not found.' }

  const vendor = (bill as Record<string, unknown>).vendors as {
    auto_publish_enabled: boolean
    hold_for_job_match: boolean
    invoices_processed: number
    qb_vendor_id: string | null
    gl_account_source: string
    billflow_gl_account_id: string | null
    qb_default_gl_account_id: string | null
    mark_as_paid_default: boolean
    default_payment_account_id: string | null
  } | null

  if (!vendor) return { eligible: false, reason: 'No vendor record linked to this bill.' }

  // 1. Auto-publish enabled on vendor
  if (!vendor.auto_publish_enabled) {
    return { eligible: false, reason: 'Auto-publish is not enabled for this vendor.' }
  }

  // 2. QB vendor linked
  if (!vendor.qb_vendor_id) {
    return { eligible: false, reason: 'This vendor is not linked to a QuickBooks vendor record.' }
  }

  // 3. Minimum 5 invoices processed
  if (vendor.invoices_processed < 5) {
    const remaining = 5 - vendor.invoices_processed
    return {
      eligible: false,
      reason: `Auto-publish unlocks after 5 invoices. ${remaining} more invoice${remaining === 1 ? '' : 's'} needed.`,
    }
  }

  // 5. Required fields present
  const b = bill as Record<string, unknown>
  const missing: string[] = []
  if (!b.invoice_number) missing.push('invoice number')
  if (!b.invoice_date) missing.push('invoice date')
  if (!b.total) missing.push('total amount')
  if (missing.length > 0) {
    return { eligible: false, reason: `Missing required fields: ${missing.join(', ')}.` }
  }

  // 6. Check for duplicate invoice number
  const { count: dupeCount } = await supabase
    .from('bills')
    .select('bill_id', { count: 'exact', head: true })
    .eq('vendor_id', (bill as Record<string, unknown>).vendor_id as string)
    .eq('invoice_number', b.invoice_number as string)
    .neq('bill_id', billId)
    .gt('created_at', new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString())

  if ((dupeCount ?? 0) > 0) {
    return { eligible: false, reason: 'A duplicate invoice number was detected for this vendor. Review before publishing.' }
  }

  // 7. Line items have GL accounts
  const lineItems = (b.bill_line_items ?? []) as Array<{ line_id: string; gl_account_id: string | null; job_id: string | null; extended_cost: number | null }>
  if (lineItems.length === 0) {
    return { eligible: false, reason: 'No line items found on this bill.' }
  }

  const missingGL = lineItems.filter(li => !li.gl_account_id && li.extended_cost != null)
  if (missingGL.length > 0) {
    return { eligible: false, reason: `${missingGL.length} line item${missingGL.length === 1 ? '' : 's'} missing a GL account.` }
  }

  // 8. Job match required if vendor flag is set
  if (vendor.hold_for_job_match) {
    const missingJob = lineItems.filter(li => !li.job_id)
    if (missingJob.length > 0) {
      return { eligible: false, reason: 'All line items must be assigned to a job before auto-publishing.' }
    }
  }

  // 8b. Jobs assigned to line items must exist in QB
  const assignedJobIds = [...new Set(lineItems.map(li => li.job_id).filter(Boolean))] as string[]
  if (assignedJobIds.length > 0) {
    const { data: knownJobs } = await supabase
      .from('qb_jobs_cache')
      .select('qb_job_id')
      .eq('company_id', companyId)
      .in('qb_job_id', assignedJobIds)
    const knownJobIds = new Set((knownJobs ?? []).map(j => j.qb_job_id))
    const missingJobs = assignedJobIds.filter(jid => !knownJobIds.has(jid))
    if (missingJobs.length > 0) {
      return {
        eligible: false,
        reason: `Auto-publish held: ${missingJobs.length === 1 ? 'a matched job is' : 'matched jobs are'} not yet in QuickBooks — waiting for job to sync from FSM.`,
      }
    }
  }

  // 9. PO discrepancy hold — if a PO-related hold reason is present, don't auto-publish
  const holdReason = (b.autopublish_hold_reason as string | null) ?? null
  if (holdReason && (holdReason.includes('PO') || holdReason.includes('discrepancy'))) {
    return { eligible: false, reason: holdReason }
  }

  // 10. Mark as Paid: if vendor default is on, payment account must be set
  const effectiveMarkAsPaid = (b.mark_as_paid as boolean | null) ?? vendor.mark_as_paid_default
  if (effectiveMarkAsPaid) {
    const paymentAccount = (b.payment_account_id as string | null) ?? vendor.default_payment_account_id
    if (!paymentAccount) {
      return {
        eligible: false,
        reason: 'Auto-publish held: payment account required — vendor is set to Mark as Paid but no payment account is configured.',
      }
    }
  }

  // 12. Line item total must exactly equal invoice total
  const invoiceTotal = b.total as number | null
  const lineItemsTotal = lineItems.reduce((sum, li) => sum + (li.extended_cost ?? 0), 0)
  if (invoiceTotal != null && Math.abs(lineItemsTotal - invoiceTotal) > 0.01) {
    return {
      eligible: false,
      reason: `Auto-publish held: line item total ($${lineItemsTotal.toFixed(2)}) does not match invoice total ($${invoiceTotal.toFixed(2)}) — difference of $${Math.abs(lineItemsTotal - invoiceTotal).toFixed(2)}.`,
    }
  }

  return { eligible: true }
}

export async function runAutopublishForCompany(companyId: string): Promise<{ attempted: number; published: number; failed: number }> {
  const supabase = createServiceClient()

  // Draft bills are checked too, but only for auto-publish vendors — a bill downgraded to
  // draft (missing GL, totals mismatch) would otherwise sit silently while the user assumes
  // it posted. Drafts are never published here; they only get a hold reason and an alert.
  const { data: candidates } = await supabase
    .from('bills')
    .select('bill_id, status, vendors!bills_vendor_id_fkey ( auto_publish_enabled )')
    .eq('company_id', companyId)
    .in('status', ['ready', 'draft'])

  const bills = ((candidates ?? []) as unknown as Array<{
    bill_id: string
    status: string
    vendors: { auto_publish_enabled: boolean } | null
  }>).filter(b => b.status === 'ready' || b.vendors?.auto_publish_enabled)

  let attempted = 0
  let published = 0
  let failed = 0

  for (const { bill_id, status, vendors } of bills) {
    const eligibility = await checkAutopublishEligibility(bill_id, companyId)

    if (!eligibility.eligible) {
      await supabase.from('bills')
        .update({ autopublish_hold_reason: eligibility.reason })
        .eq('bill_id', bill_id)
      if (vendors?.auto_publish_enabled) {
        await notifyAutopublishHeld(companyId, bill_id, eligibility.reason)
      }
      if (status === 'ready') {
        attempted++
        failed++
      }
      continue
    }

    if (status !== 'ready') continue
    attempted++

    // Clear any prior hold reason
    await supabase.from('bills')
      .update({ autopublish_hold_reason: null, publish_method: 'auto' })
      .eq('bill_id', bill_id)

    try {
      await pushBillToQBO(bill_id, companyId)
      published++
    } catch {
      // pushBillToQBO already marks the bill as sync_error and the user is notified.
      // Don't auto-disable the vendor — a single bill failure (e.g. a credit note with
      // a negative amount, a duplicate, a transient QB error) should not stop all future
      // invoices from that vendor from auto-publishing. The sync_error badge on the bill
      // is sufficient to require the user's attention on that specific bill.
      failed++
    }
  }

  return { attempted, published, failed }
}

// Alerts once per bill when a vendor is on auto-publish but a bill was held back.
// The cron re-checks held bills daily, so the processing_log entry prevents a repeat email
// every morning for the same bill.
async function notifyAutopublishHeld(companyId: string, billId: string, reason: string): Promise<void> {
  const supabase = createServiceClient()

  const { count } = await supabase
    .from('processing_log')
    .select('id', { count: 'exact', head: true })
    .eq('bill_id', billId)
    .eq('action', 'autopublish_held_notified')
  if ((count ?? 0) > 0) return

  const { data: bill } = await supabase
    .from('bills')
    .select('invoice_number, total, vendor_name_raw, vendors!bills_vendor_id_fkey ( vendor_name_display )')
    .eq('bill_id', billId)
    .single()

  const b = bill as unknown as {
    invoice_number: string | null
    total: number | null
    vendor_name_raw: string | null
    vendors: { vendor_name_display: string | null } | null
  } | null
  const vendorName = b?.vendors?.vendor_name_display ?? b?.vendor_name_raw ?? 'Unknown vendor'
  const invoice = b?.invoice_number ? `Invoice ${b.invoice_number}` : 'An invoice'
  const amount = b?.total != null ? ` ($${Number(b.total).toFixed(2)})` : ''

  await sendNotification({
    companyId,
    event:   'autopublish_held',
    subject: `Not auto-published: ${vendorName}`,
    body:    `${invoice}${amount} from ${vendorName} was not posted to QuickBooks automatically.\n\nReason: ${reason}\n\nIt is waiting for you in Purchasomatic — fix the issue and publish it.`,
    billId,
  })

  await supabase.from('processing_log').insert({
    bill_id:     billId,
    action:      'autopublish_held_notified',
    actor:       'system',
    after_state: { reason },
  })
}
