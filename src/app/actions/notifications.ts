'use server'

import { createClient } from '@/lib/supabase/server'

export async function markNotificationRead(id: string): Promise<void> {
  const supabase = await createClient()
  await supabase.from('notifications').update({ is_read: true }).eq('id', id)
}
