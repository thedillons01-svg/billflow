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
  // Delete line items first (cascade should handle it, but explicit for safety)
  await supabase.from('bill_line_items').delete().eq('bill_id', billId)
  await supabase.from('bills').delete().eq('bill_id', billId)
  revalidatePath('/trash')
}
