import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ClassSetupClient } from './ClassSetupClient'

export default async function ClassSetupPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: member } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', user.id)
    .single()

  if (!member?.company_id) redirect('/settings')

  const companyId = member.company_id

  const [
    { data: company },
    { data: classes },
    { data: vendors },
    { data: customers },
  ] = await Promise.all([
    supabase
      .from('companies')
      .select('class_assignment_mode, class_tracking_enabled, qb_connection_status')
      .eq('company_id', companyId)
      .single(),
    supabase
      .from('qb_classes_cache')
      .select('qb_class_id, name')
      .eq('company_id', companyId)
      .not('is_hidden', 'is', true)
      .order('name'),
    supabase
      .from('vendors')
      .select('vendor_id, vendor_name_display, billflow_class_id')
      .eq('company_id', companyId)
      .eq('is_visible', true)
      .order('vendor_name_display'),
    supabase
      .from('qb_jobs_cache')
      .select('qb_job_id, job_name, customer_name, assigned_class_id')
      .eq('company_id', companyId)
      .eq('is_customer', true)
      .eq('status', 'active')
      .order('job_name'),
  ])

  if (!company?.class_tracking_enabled) redirect('/settings')

  return (
    <ClassSetupClient
      companyId={companyId}
      mode={(company.class_assignment_mode ?? 'vendor') as 'vendor' | 'customer'}
      classes={classes ?? []}
      vendors={vendors ?? []}
      customers={customers ?? []}
      isQBConnected={company.qb_connection_status === 'connected'}
    />
  )
}
