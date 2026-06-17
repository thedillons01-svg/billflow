'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { pushBillToQBO } from '@/lib/quickbooks/push'
import { syncAll } from '@/lib/quickbooks/sync'
import { tryMatchJob, applyCustomerClassToLines } from '@/lib/ocr/process'

type BulkPublishResult = {
  success: number
  failed: number
  errors: { billId: string; invoiceNumber: string | null; reason: string }[]
}

export async function bulkPublish(billIds: string[]): Promise<BulkPublishResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: 0, failed: billIds.length, errors: [] }

  const { data: company } = await supabase
    .from('companies')
    .select('company_id, qb_connection_status')
    .single()

  if (!company || company.qb_connection_status !== 'connected') {
    return {
      success: 0,
      failed: billIds.length,
      errors: billIds.map(id => ({ billId: id, invoiceNumber: null, reason: 'QuickBooks is not connected.' })),
    }
  }

  const service = createServiceClient()
  let success = 0
  const errors: BulkPublishResult['errors'] = []

  for (const billId of billIds) {
    try {
      const { data: bill } = await supabase
        .from('bills')
        .select('bill_id, status, invoice_number')
        .eq('bill_id', billId)
        .eq('company_id', company.company_id)
        .single()

      if (!bill || ['published', 'publishing'].includes(bill.status)) {
        const reason = !bill
          ? 'Bill not found'
          : bill.status === 'published'
            ? 'Already published to QuickBooks'
            : 'Currently being pushed to QuickBooks — try again in a moment'
        errors.push({ billId, invoiceNumber: bill?.invoice_number ?? null, reason })
        continue
      }

      await service.from('bills')
        .update({ publish_method: 'manual' })
        .eq('bill_id', billId)

      await pushBillToQBO(billId, company.company_id)
      success++
    } catch (err) {
      // Re-fetch the sync error that push.ts wrote to the DB — cleaner than parsing the thrown message
      const { data: errBill } = await supabase
        .from('bills')
        .select('invoice_number, qb_sync_error')
        .eq('bill_id', billId)
        .single()
      errors.push({
        billId,
        invoiceNumber: errBill?.invoice_number ?? null,
        reason: errBill?.qb_sync_error ?? (err instanceof Error ? err.message : 'Unknown error'),
      })
    }
  }

  return { success, failed: errors.length, errors }
}

type BulkJobMatchResult = {
  matched: number
  notFound: number
  skipped: number
}

export async function bulkFindJobMatch(billIds: string[]): Promise<BulkJobMatchResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { matched: 0, notFound: 0, skipped: billIds.length }

  const { data: company } = await supabase
    .from('companies')
    .select('company_id, class_assignment_mode')
    .single()
  if (!company) return { matched: 0, notFound: 0, skipped: billIds.length }

  const { data: bills } = await supabase
    .from('bills')
    .select('bill_id, company_id, vendor_po_reference, job_name_extracted, customer_name_extracted, status')
    .in('bill_id', billIds)
    .eq('company_id', company.company_id)

  if (!bills || bills.length === 0) return { matched: 0, notFound: 0, skipped: billIds.length }

  const eligible = bills.filter(b => b.status !== 'published' && b.status !== 'publishing')
  const skipped = billIds.length - eligible.length

  if (eligible.length === 0) return { matched: 0, notFound: 0, skipped }

  // Sync once before attempting matches so newly created QB jobs are visible
  try { await syncAll(company.company_id) } catch { /* non-fatal */ }

  const service = createServiceClient()
  let matched = 0
  let notFound = 0

  for (const bill of eligible) {
    const matchRef = (bill.vendor_po_reference as string | null) ?? (bill.job_name_extracted as string | null)
    if (!matchRef) { notFound++; continue }

    const didMatch = await tryMatchJob(
      service,
      bill.bill_id as string,
      bill.company_id as string,
      matchRef,
      (bill.job_name_extracted as string | null) ?? undefined,
      (bill.customer_name_extracted as string | null) ?? undefined,
    )

    if (didMatch) {
      matched++
      if (company.class_assignment_mode === 'customer') {
        const { data: lineWithJob } = await service
          .from('bill_line_items')
          .select('job_id')
          .eq('bill_id', bill.bill_id as string)
          .not('job_id', 'is', null)
          .limit(1)
          .maybeSingle()
        if (lineWithJob?.job_id) {
          await applyCustomerClassToLines(service, bill.bill_id as string, bill.company_id as string, lineWithJob.job_id as string)
        }
      }
    } else {
      notFound++
    }
  }

  return { matched, notFound, skipped }
}
