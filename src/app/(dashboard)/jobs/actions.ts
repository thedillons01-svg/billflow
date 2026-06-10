'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getQBClient } from '@/lib/quickbooks/client'

export async function createJob(
  companyId: string,
  displayName: string,
  parentCustomerId?: string
): Promise<{ qbJobId: string; jobName: string; jobNumber: string | null; customerName: string | null } | { error: string }> {
  const supabase = await createClient()

  let qbJobId: string
  let returnedName: string = displayName

  try {
    const { qbPost } = await getQBClient(companyId)
    const payload: Record<string, unknown> = { DisplayName: displayName }
    if (parentCustomerId) {
      payload.ParentRef = { value: parentCustomerId }
      payload.Job = true
    }
    try {
      const result = await qbPost('customer', payload)
      qbJobId = result.Customer?.Id
      returnedName = result.Customer?.DisplayName ?? displayName
      if (!qbJobId) return { error: 'QuickBooks did not return a job ID' }
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      const dupMatch = msg.match(/"code":"6240"[\s\S]*?Id=(\d+)/)
      if (dupMatch) {
        qbJobId = dupMatch[1]
      } else {
        throw e
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : ''
    return {
      error: msg.includes('not connected')
        ? 'QuickBooks is not connected. Connect QuickBooks in Settings before creating jobs.'
        : `Could not create job in QuickBooks: ${msg || 'unknown error'}`,
    }
  }

  // Extract job number from name — skip year-like numbers (2000-2099)
  const jobNumberMatch = displayName.match(/\b(\d{3,})\b/g)
  const jobNumber = jobNumberMatch?.find(n => {
    const num = parseInt(n, 10)
    return !(num >= 2000 && num <= 2099)
  }) ?? null

  // Get parent customer name if sub-customer
  let customerName: string | null = null
  if (parentCustomerId) {
    const { data: parent } = await supabase
      .from('qb_jobs_cache')
      .select('job_name')
      .eq('company_id', companyId)
      .eq('qb_job_id', parentCustomerId)
      .single()
    customerName = parent?.job_name ?? null
  }

  await supabase.from('qb_jobs_cache').upsert({
    company_id:    companyId,
    qb_job_id:     qbJobId,
    job_name:      returnedName,
    job_number:    jobNumber,
    customer_name: customerName,
    parent_id:     parentCustomerId ?? null,
    is_customer:   !parentCustomerId,
    status:        'active',
    cached_at:     new Date().toISOString(),
  }, { onConflict: 'company_id,qb_job_id' })

  revalidatePath('/jobs')
  return { qbJobId, jobName: returnedName, jobNumber, customerName }
}

export async function renameJob(
  companyId: string,
  qbJobId: string,
  newDisplayName: string
): Promise<{ jobName: string; jobNumber: string | null } | { error: string }> {
  const supabase = await createClient()

  try {
    const { qbFetchAll, qbPost } = await getQBClient(companyId)

    // QB requires a SyncToken to update a record — fetch current state first
    type QBCustomer = { Id: string; SyncToken: string; DisplayName: string }
    const rows = await qbFetchAll<QBCustomer>('Customer', `SELECT * FROM Customer WHERE Id = '${qbJobId}'`)
    const current = rows[0]
    if (!current?.SyncToken) return { error: 'Could not fetch current job record from QuickBooks.' }

    const result = await qbPost('customer', {
      Id: qbJobId,
      SyncToken: current.SyncToken,
      DisplayName: newDisplayName,
      sparse: true,
    })
    const returnedName: string = result.Customer?.DisplayName ?? newDisplayName
    if (!result.Customer?.Id) return { error: 'QuickBooks did not confirm the rename.' }

    const jobNumberMatch = newDisplayName.match(/\b(\d{3,})\b/g)
    const jobNumber = jobNumberMatch?.find(n => {
      const num = parseInt(n, 10)
      return !(num >= 2000 && num <= 2099)
    }) ?? null

    await supabase.from('qb_jobs_cache')
      .update({ job_name: returnedName, job_number: jobNumber })
      .eq('company_id', companyId)
      .eq('qb_job_id', qbJobId)

    revalidatePath('/jobs')
    return { jobName: returnedName, jobNumber }
  } catch (e) {
    const msg = e instanceof Error ? e.message : ''
    return {
      error: msg.includes('not connected')
        ? 'QuickBooks is not connected.'
        : `Could not rename job: ${msg || 'unknown error'}`,
    }
  }
}

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
