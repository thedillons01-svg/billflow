'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { syncAll } from '@/lib/quickbooks/sync'

export async function disconnectQuickBooks(companyId: string) {
  const supabase = await createClient()
  await supabase
    .from('companies')
    .update({
      qb_realm_id:          null,
      qb_access_token:      null,
      qb_refresh_token:     null,
      qb_token_expires_at:  null,
      qb_connection_status: 'disconnected',
    })
    .eq('company_id', companyId)
  revalidatePath('/settings')
}

export async function triggerQBSync(companyId: string) {
  await syncAll(companyId)
  revalidatePath('/settings')
}

export async function updateNotificationSettings(
  companyId: string,
  settings: {
    notification_emails: string[]
    success_notifications: boolean
    daily_digest: boolean
  }
) {
  const supabase = await createClient()
  await supabase
    .from('companies')
    .update(settings)
    .eq('company_id', companyId)
  revalidatePath('/settings')
}

export async function updateCapturePrefix(companyId: string, prefix: string) {
  const clean = prefix.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 30)
  if (!clean) return { error: 'Prefix cannot be empty.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('companies')
    .update({ capture_email_prefix: clean })
    .eq('company_id', companyId)

  if (error) return { error: 'That prefix may already be taken. Try another.' }
  revalidatePath('/settings')
  return { ok: true, prefix: clean }
}

export async function toggleAccountVisibility(accountId: string, isHidden: boolean) {
  const supabase = await createClient()
  await supabase
    .from('qb_accounts_cache')
    .update({ is_hidden: isHidden })
    .eq('id', accountId)
  revalidatePath('/settings')
  revalidatePath('/bills')
}

export async function updateCompanySettings(
  companyId: string,
  settings: {
    use_items_table?: boolean
    job_costing_enabled?: boolean
    fsm_platform?: string | null
  }
) {
  const supabase = await createClient()
  await supabase
    .from('companies')
    .update(settings)
    .eq('company_id', companyId)
  revalidatePath('/settings')
}
