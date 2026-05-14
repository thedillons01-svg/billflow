'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export const poActions = {}

export async function closePO(poId: string) {
  const supabase = await createClient()
  await supabase
    .from('purchase_orders')
    .update({ status: 'closed' })
    .eq('po_id', poId)
  revalidatePath('/purchase-orders')
}

export async function deletePO(poId: string) {
  const supabase = await createClient()
  await supabase
    .from('purchase_orders')
    .update({ deleted_at: new Date().toISOString() })
    .eq('po_id', poId)
  revalidatePath('/purchase-orders')
}
