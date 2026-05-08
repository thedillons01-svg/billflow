'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updateVendor(
  vendorId: string,
  updates: Record<string, string | boolean | null>
) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('vendors')
    .update(updates)
    .eq('vendor_id', vendorId)
  if (error) throw new Error(error.message)
  revalidatePath('/vendors')
}
