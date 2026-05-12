import { createServiceClient } from '@/lib/supabase/service'
import { pushBillToQBO } from '@/lib/quickbooks/push'

type EligibilityResult = { eligible: true } | { eligible: false; reason: string }

export async function checkAutopublishEligibility(billId: string, companyId: string): Promise<EligibilityResult> {
  const supabase = createServiceClient()

  const { data: bill } = await supabase
    .from('bills')
    .select(`
      bill_id, invoice_number, invoice_date, total, vendor_id,
      bill_line_items ( line_id, gl_account_id, job_id, extended_cost ),
      vendors!bills_vendor_id_fkey (
        vendor_id, auto_publish_enabled, hold_for_job_match,
        invoices_processed, qb_vendor_id, gl_account_source,
        billflow_gl_account_id, qb_default_gl_account_id
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

  // 4. Zero errors on last 3 invoices for this vendor
  const { data: recentBills } = await supabase
    .from('bills')
    .select('status')
    .eq('vendor_id', (bill as Record<string, unknown>).vendor_id as string)
    .eq('company_id', companyId)
    .in('status', ['published', 'sync_error'])
    .order('created_at', { ascending: false })
    .limit(3)

  const hasRecentError = recentBills?.some(b => b.status === 'sync_error') ?? false
  if (hasRecentError) {
    return {
      eligible: false,
      reason: 'A recent invoice from this vendor had a sync error. Resolve the error before auto-publish can resume.',
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

  return { eligible: true }
}

export async function runAutopublishForCompany(companyId: string): Promise<{ attempted: number; published: number; failed: number }> {
  const supabase = createServiceClient()

  const { data: readyBills } = await supabase
    .from('bills')
    .select('bill_id')
    .eq('company_id', companyId)
    .eq('status', 'ready')

  if (!readyBills || readyBills.length === 0) return { attempted: 0, published: 0, failed: 0 }

  let published = 0
  let failed = 0

  for (const { bill_id } of readyBills) {
    const eligibility = await checkAutopublishEligibility(bill_id, companyId)

    if (!eligibility.eligible) {
      await supabase.from('bills')
        .update({ autopublish_hold_reason: eligibility.reason })
        .eq('bill_id', bill_id)
      failed++
      continue
    }

    // Clear any prior hold reason
    await supabase.from('bills')
      .update({ autopublish_hold_reason: null, publish_method: 'auto' })
      .eq('bill_id', bill_id)

    try {
      await pushBillToQBO(bill_id, companyId)
      published++
    } catch {
      // pushBillToQBO already sets sync_error on the bill
      // Auto-disable vendor auto-publish on error
      const { data: billData } = await supabase
        .from('bills')
        .select('vendor_id')
        .eq('bill_id', bill_id)
        .single()
      if (billData?.vendor_id) {
        await supabase.from('vendors')
          .update({ auto_publish_enabled: false })
          .eq('vendor_id', billData.vendor_id)
      }
      failed++
    }
  }

  return { attempted: readyBills.length, published, failed }
}
