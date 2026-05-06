'use server'

import { createClient } from '@/lib/supabase/server'

export async function updateBill(
  billId: string,
  updates: Record<string, string | number | null>
) {
  const supabase = await createClient()
  const { error } = await supabase.from('bills').update(updates).eq('bill_id', billId)
  if (error) throw new Error(error.message)
}

export async function updateLineItem(
  lineId: string,
  updates: Record<string, string | number | null>
) {
  const supabase = await createClient()
  const { error } = await supabase.from('bill_line_items').update(updates).eq('line_id', lineId)
  if (error) throw new Error(error.message)
}

export async function setBillStatus(billId: string, status: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('bills').update({ status }).eq('bill_id', billId)
  if (error) throw new Error(error.message)
}
