'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { pushBillToQBO } from '@/lib/quickbooks/push'

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
