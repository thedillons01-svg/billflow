import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { syncJobsIfStale } from '@/lib/quickbooks/sync'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', user.id)
    .single()

  if (!membership) return NextResponse.json({ error: 'No company' }, { status: 403 })

  const companyId = membership.company_id

  // Refresh from QB if stale — rate-limited to once per 5 minutes
  await syncJobsIfStale(companyId).catch(() => {})

  const service = createServiceClient()
  const { data: jobs } = await service
    .from('qb_jobs_cache')
    .select('qb_job_id, job_number, job_name, customer_name')
    .eq('company_id', companyId)
    .order('customer_name')
    .order('job_name')

  return NextResponse.json({ jobs: jobs ?? [] })
}
