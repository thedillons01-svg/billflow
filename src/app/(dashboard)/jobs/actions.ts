'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function closeJob(qbJobId: string): Promise<void> {
  const supabase = await createClient()
  const { data: company } = await supabase.from('companies').select('company_id').single()
  if (!company) return
  await supabase.from('qb_jobs_cache')
    .update({ status: 'closed' })
    .eq('company_id', company.company_id)
    .eq('qb_job_id', qbJobId)
  revalidatePath('/jobs')
}

export async function reopenJob(qbJobId: string): Promise<void> {
  const supabase = await createClient()
  const { data: company } = await supabase.from('companies').select('company_id').single()
  if (!company) return
  await supabase.from('qb_jobs_cache')
    .update({ status: 'active' })
    .eq('company_id', company.company_id)
    .eq('qb_job_id', qbJobId)
  revalidatePath('/jobs')
}
