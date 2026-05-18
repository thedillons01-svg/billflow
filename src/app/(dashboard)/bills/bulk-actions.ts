'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { pushBillToQBO } from '@/lib/quickbooks/push'

export async function bulkPublish(billIds: string[]): Promise<{ success: number; failed: number }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: 0, failed: billIds.length }

  const { data: company } = await supabase
    .from('companies')
    .select('company_id, qb_connection_status')
    .single()

  if (!company || company.qb_connection_status !== 'connected') {
    return { success: 0, failed: billIds.length }
  }

  const service = createServiceClient()
  let success = 0
  let failed = 0

  for (const billId of billIds) {
    try {
      // Verify bill belongs to this company
      const { data: bill } = await supabase
        .from('bills')
        .select('bill_id, status')
        .eq('bill_id', billId)
        .eq('company_id', company.company_id)
        .single()

      if (!bill || !['ready', 'sync_error'].includes(bill.status)) {
        failed++
        continue
      }

      // Set publish_method before push so autopublish confidence tracking works correctly
      await service.from('bills')
        .update({ publish_method: 'manual' })
        .eq('bill_id', billId)

      await pushBillToQBO(billId, company.company_id)
      success++
    } catch {
      failed++
    }
  }

  return { success, failed }
}
