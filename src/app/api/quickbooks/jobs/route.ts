import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { syncJobsIfStale } from '@/lib/quickbooks/sync'

export async function GET(req: NextRequest) {
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
  await syncJobsIfStale(companyId).catch(() => {})

  // Fetch company settings
  const service = createServiceClient()
  const { data: company } = await service
    .from('companies')
    .select('job_tagging_level')
    .eq('company_id', companyId)
    .single()

  const taggingLevel = company?.job_tagging_level ?? 'sub_customers_only'
  const includeClosed = req.nextUrl.searchParams.get('includeClosed') === 'true'

  let query = service
    .from('qb_jobs_cache')
    .select('qb_job_id, job_number, job_name, customer_name, parent_id, is_customer, status')
    .eq('company_id', companyId)
    .order('customer_name')
    .order('job_name')

  // Filter by status
  if (!includeClosed) query = query.eq('status', 'active')

  // Filter by tagging level
  if (taggingLevel === 'sub_customers_only') query = query.eq('is_customer', false)
  else if (taggingLevel === 'customers_only')   query = query.eq('is_customer', true)
  // 'both': no filter

  const { data: jobs } = await query

  return NextResponse.json({ jobs: jobs ?? [], taggingLevel })
}
