'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function restoreBill(billId: string) {
  const supabase = await createClient()
  await supabase
    .from('bills')
    .update({ deleted_at: null })
    .eq('bill_id', billId)
  revalidatePath('/trash')
  revalidatePath('/bills')
}

export async function permanentlyDeleteBill(billId: string) {
  const supabase = await createClient()
  await supabase.from('bill_line_items').delete().eq('bill_id', billId)
  await supabase.from('bills').delete().eq('bill_id', billId)
  revalidatePath('/trash')
}

export async function restorePO(poId: string) {
  const supabase = await createClient()
  await supabase.from('purchase_orders').update({ deleted_at: null }).eq('po_id', poId)
  revalidatePath('/trash')
  revalidatePath('/purchase-orders')
}

export async function permanentlyDeletePO(poId: string) {
  const supabase = await createClient()
  await supabase.from('po_line_items').delete().eq('po_id', poId)
  await supabase.from('purchase_orders').delete().eq('po_id', poId)
  revalidatePath('/trash')
}
