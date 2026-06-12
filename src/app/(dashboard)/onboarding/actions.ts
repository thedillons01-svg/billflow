'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { redirect } from 'next/navigation'

type ServiceClient = ReturnType<typeof createServiceClient>

async function generateCapturePrefix(name: string, service: ServiceClient): Promise<string> {
  const base = name.trim().toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20) || 'company'
  const { data: existing } = await service
    .from('companies')
    .select('capture_email_prefix')
    .eq('capture_email_prefix', base)
    .maybeSingle()
  if (!existing) return base
  for (let i = 2; i <= 99; i++) {
    const candidate = `${base}${i}`
    const { data: exists } = await service
      .from('companies')
      .select('capture_email_prefix')
      .eq('capture_email_prefix', candidate)
      .maybeSingle()
    if (!exists) return candidate
  }
  return `${base}${Date.now().toString().slice(-4)}`
}

export async function saveCompanySetup(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const name = formData.get('name') as string
  const qbType = formData.get('qb_type') as 'qbo' | 'qbd' | null
  const fsmPlatform = (formData.get('fsm_platform') as string) || 'unknown'
  const jobCostingEnabled = formData.get('job_costing_enabled') === 'true'

  // Use service client so we can read/write company + membership regardless of prior state
  const service = createServiceClient()

  // Check if this user already has a company membership
  const { data: membership } = await service
    .from('company_members')
    .select('company_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  if (membership) {
    // Update the existing company
    await service.from('companies')
      .update({
        name: name.trim(),
        qb_type: qbType,
        fsm_platform: fsmPlatform,
        job_costing_enabled: jobCostingEnabled,
      })
      .eq('company_id', membership.company_id)
  } else {
    // Create a new company and link the user to it
    const capturePrefix = await generateCapturePrefix(name, service)

    const { data: newCompany, error } = await service.from('companies').insert({
      name: name.trim(),
      qb_type: qbType,
      fsm_platform: fsmPlatform,
      job_costing_enabled: jobCostingEnabled,
      capture_email_prefix: capturePrefix,
    }).select('company_id').single()

    if (error || !newCompany) throw new Error('Failed to create company')

    await service.from('company_members').insert({
      user_id: user.id,
      company_id: newCompany.company_id,
      role: 'owner',
    })

    // Grant 25 free trial credits and record in ledger
    await service.from('companies')
      .update({ credit_balance: 25, subscription_status: 'trial' })
      .eq('company_id', newCompany.company_id)

    await service.from('credit_ledger').insert({
      company_id:  newCompany.company_id,
      amount:      25,
      description: 'Free trial — 25 credits',
    })
  }

  redirect('/bills')
}

// Same as saveCompanySetup but does NOT redirect — used by step 1 of the onboarding form
// so the company exists before the user clicks "Connect QuickBooks" on step 2.
export async function saveCompanySetupStep1(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const name = formData.get('name') as string
  const qbType = formData.get('qb_type') as 'qbo' | 'qbd' | null
  const fsmPlatform = (formData.get('fsm_platform') as string) || 'unknown'
  const jobCostingEnabled = formData.get('job_costing_enabled') === 'true'

  const service = createServiceClient()

  const { data: membership } = await service
    .from('company_members')
    .select('company_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  if (membership) {
    await service.from('companies')
      .update({
        name: name.trim(),
        qb_type: qbType,
        fsm_platform: fsmPlatform,
        job_costing_enabled: jobCostingEnabled,
      })
      .eq('company_id', membership.company_id)
  } else {
    const capturePrefix = await generateCapturePrefix(name, service)

    const { data: newCompany, error } = await service.from('companies').insert({
      name: name.trim(),
      qb_type: qbType,
      fsm_platform: fsmPlatform,
      job_costing_enabled: jobCostingEnabled,
      capture_email_prefix: capturePrefix,
    }).select('company_id').single()

    if (error || !newCompany) throw new Error('Failed to create company')

    await service.from('company_members').insert({
      user_id: user.id,
      company_id: newCompany.company_id,
      role: 'owner',
    })

    await service.from('companies')
      .update({ credit_balance: 25, subscription_status: 'trial' })
      .eq('company_id', newCompany.company_id)

    await service.from('credit_ledger').insert({
      company_id:  newCompany.company_id,
      amount:      25,
      description: 'Free trial — 25 credits',
    })
  }
  // No redirect — caller advances the step in client state
}
