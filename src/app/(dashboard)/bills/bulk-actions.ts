'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { pushBillToQBO } from '@/lib/quickbooks/push'

type BulkPublishResult = {
  success: number
  failed: number
  errors: { billId: string; invoiceNumber: string | null; reason: string; canMarkReady?: boolean }[]
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

      if (!bill || !['ready', 'sync_error'].includes(bill.status)) {
        const statusReasons: Record<string, { reason: string; canMarkReady?: boolean }> = {
          draft:             { reason: 'Status is Needs Review — mark it Ready first', canMarkReady: true },
          published:         { reason: 'Already published to QuickBooks' },
          pending_job_match: { reason: 'Status is Pending — waiting for a QuickBooks job match' },
          publishing:        { reason: 'Currently being pushed to QuickBooks' },
          ocr_error:         { reason: 'Status is OCR Error — reprocess it first' },
          sync_error:        { reason: 'Status is Sync Error' },
        }
        const info = bill ? (statusReasons[bill.status] ?? { reason: 'Cannot be published in its current state' }) : { reason: 'Bill not found' }
        errors.push({
          billId,
          invoiceNumber: bill?.invoice_number ?? null,
          reason: info.reason,
          canMarkReady: info.canMarkReady,
        })
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
