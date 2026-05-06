'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function disconnectQuickBooks(companyId: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('companies')
    .update({
      qb_realm_id:          null,
      qb_access_token:      null,
      qb_refresh_token:     null,
      qb_token_expires_at:  null,
      qb_connection_status: 'disconnected',
    })
    .eq('company_id', companyId)

  if (error) throw new Error(error.message)
  revalidatePath('/settings')
}
