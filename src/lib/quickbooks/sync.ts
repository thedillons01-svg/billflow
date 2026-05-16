import { createServiceClient } from '@/lib/supabase/service'
import { getQBClient } from './client'

type QBAccount = {
  Id: string
  Name: string
  AccountType: string
  AccountSubType: string
  Active: boolean
}

type QBVendor = {
  Id: string
  DisplayName: string
  DefaultExpenseAccountRef?: { value: string; name: string }
  SalesTermRef?: { value: string; name: string }
  Active: boolean
}

type QBCustomer = {
  Id: string
  DisplayName: string
  FullyQualifiedName: string
  ParentRef?: { value: string; name: string }
  Job: boolean
  Active: boolean
}

type QBClass = {
  Id: string
  Name: string
  FullyQualifiedName: string
  Active: boolean
}

export async function syncAccounts(companyId: string) {
  const supabase = createServiceClient()
  const { qbFetchAll } = await getQBClient(companyId)

  const accounts = await qbFetchAll<QBAccount>(
    'Account',
    "SELECT * FROM Account WHERE Active = true"
  )
  if (accounts.length === 0) return

  const { error } = await supabase.from('qb_accounts_cache').upsert(
    accounts.map(a => ({
      company_id: companyId,
      qb_account_id: a.Id,
      name: a.Name,
      account_type: a.AccountType,
      account_sub_type: a.AccountSubType,
      cached_at: new Date().toISOString(),
    })),
    { onConflict: 'company_id,qb_account_id', ignoreDuplicates: false }
  )
  if (error) throw new Error(`Accounts cache upsert failed: ${error.message}`)
}

export async function syncVendors(companyId: string) {
  const supabase = createServiceClient()
  const { qbFetchAll } = await getQBClient(companyId)

  const vendors = await qbFetchAll<QBVendor>(
    'Vendor',
    'SELECT * FROM Vendor WHERE Active = true'
  )
  if (vendors.length === 0) return

  await supabase.from('qb_vendors_cache').delete().eq('company_id', companyId)
  const { error } = await supabase.from('qb_vendors_cache').insert(
    vendors.map(v => ({
      company_id: companyId,
      qb_vendor_id: v.Id,
      name: v.DisplayName,
      default_expense_account_id: v.DefaultExpenseAccountRef?.value ?? null,
      payment_terms: v.SalesTermRef?.name ?? null,
      cached_at: new Date().toISOString(),
    }))
  )
  if (error) throw new Error(`Vendors cache insert failed: ${error.message}`)
}

export async function syncJobs(companyId: string) {
  const supabase = createServiceClient()
  const { qbFetchAll } = await getQBClient(companyId)

  const jobs = await qbFetchAll<QBCustomer>(
    'Customer',
    'SELECT * FROM Customer WHERE Job = true AND Active = true'
  )
  if (jobs.length === 0) return

  await supabase.from('qb_jobs_cache').delete().eq('company_id', companyId)
  const { error } = await supabase.from('qb_jobs_cache').insert(
    jobs.map(j => {
      // FullyQualifiedName format: "Customer Name:Job Name"
      const parts = j.FullyQualifiedName.split(':')
      const customerName = parts.length > 1 ? parts.slice(0, -1).join(':') : (j.ParentRef?.name ?? '')
      const jobName = parts[parts.length - 1]
      const jobNumberMatch = jobName.match(/\b(\d+)\b/)

      return {
        company_id: companyId,
        qb_job_id: j.Id,
        job_name: jobName,
        job_number: jobNumberMatch?.[1] ?? null,
        customer_name: customerName,
        customer_id: j.ParentRef?.value ?? null,
        cached_at: new Date().toISOString(),
      }
    })
  )
  if (error) throw new Error(`Jobs cache insert failed: ${error.message}`)
}

export async function syncClasses(companyId: string) {
  const supabase = createServiceClient()
  const { qbFetchAll } = await getQBClient(companyId)

  let classes: QBClass[]
  try {
    classes = await qbFetchAll<QBClass>(
      'Class',
      'SELECT * FROM Class WHERE Active = true'
    )
  } catch {
    return
  }
  if (classes.length === 0) return

  const { error } = await supabase.from('qb_classes_cache').upsert(
    classes.map(c => ({
      company_id: companyId,
      qb_class_id: c.Id,
      name: c.Name,
      cached_at: new Date().toISOString(),
    })),
    { onConflict: 'company_id,qb_class_id', ignoreDuplicates: false }
  )
  if (error) throw new Error(`Classes cache upsert failed: ${error.message}`)
}

export async function syncAll(companyId: string) {
  await Promise.all([
    syncAccounts(companyId),
    syncVendors(companyId),
    syncJobs(companyId),
    syncClasses(companyId).catch(() => {}),
  ])

  const supabase = createServiceClient()
  await supabase
    .from('companies')
    .update({ qb_last_sync: new Date().toISOString() })
    .eq('company_id', companyId)
}
