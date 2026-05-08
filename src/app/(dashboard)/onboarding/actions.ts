'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { randomBytes } from 'crypto'

export async function saveCompanySetup(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const name = formData.get('name') as string
  const qbType = formData.get('qb_type') as 'qbo' | 'qbd' | null
  const fsmPlatform = (formData.get('fsm_platform') as string) || 'unknown'
  const jobCostingEnabled = formData.get('job_costing_enabled') === 'true'

  // Check if company already exists for this user
  const { data: existing } = await supabase
    .from('companies')
    .select('company_id')
    .single()

  if (existing) {
    // Update existing
    await supabase.from('companies')
      .update({
        name: name.trim(),
        qb_type: qbType,
        fsm_platform: fsmPlatform,
        job_costing_enabled: jobCostingEnabled,
      })
      .eq('company_id', existing.company_id)
  } else {
    // Create new company (RLS placeholder means we can insert directly)
    const capturePrefix = name.trim().toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20) + randomBytes(3).toString('hex')
    await supabase.from('companies').insert({
      name: name.trim(),
      qb_type: qbType,
      fsm_platform: fsmPlatform,
      job_costing_enabled: jobCostingEnabled,
      capture_email_prefix: capturePrefix,
    })
  }

  redirect('/bills')
}
