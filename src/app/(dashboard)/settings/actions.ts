'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { syncAll } from '@/lib/quickbooks/sync'

export async function disconnectQuickBooks(companyId: string) {
  const supabase = await createClient()

  // Fetch refresh token before clearing so we can revoke it with Intuit
  const { data: company } = await supabase
    .from('companies')
    .select('qb_refresh_token')
    .eq('company_id', companyId)
    .single()

  // Revoke with Intuit so the next Connect forces company selection
  if (company?.qb_refresh_token) {
    const credentials = Buffer.from(
      `${process.env.QBO_CLIENT_ID}:${process.env.QBO_CLIENT_SECRET}`
    ).toString('base64')
    await fetch('https://developer.api.intuit.com/v2/oauth2/tokens/revoke', {
      method: 'POST',
      headers: {
        Authorization:  `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept:         'application/json',
      },
      body: new URLSearchParams({ token: company.qb_refresh_token }),
    }).catch(() => { /* non-fatal */ })
  }

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
    notify_uploader?: boolean
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

export async function toggleClassVisibility(classId: string, isHidden: boolean) {
  const supabase = await createClient()
  await supabase
    .from('qb_classes_cache')
    .update({ is_hidden: isHidden })
    .eq('id', classId)
  revalidatePath('/settings')
  revalidatePath('/bills')
}

export async function updateCompanyDetails(
  companyId: string,
  details: { name: string }
) {
  const supabase = await createClient()
  const name = details.name.trim()
  if (!name) return { error: 'Company name is required.' }
  await supabase
    .from('companies')
    .update({ name })
    .eq('company_id', companyId)
  revalidatePath('/settings')
  revalidatePath('/home')
  return { ok: true }
}

export async function updateCompanySettings(
  companyId: string,
  settings: {
    use_items_table?: boolean
    job_costing_enabled?: boolean
    class_tracking_enabled?: boolean
    push_pos_to_qb?: boolean
    fsm_platform?: string | null
    qb_ref_source?: string
    default_due_date?: string
    job_tagging_level?: string
    auto_close_jobs_days?: number | null
    show_field_tips?: boolean
  }
) {
  const supabase = await createClient()
  await supabase
    .from('companies')
    .update(settings)
    .eq('company_id', companyId)
  revalidatePath('/settings')
}
