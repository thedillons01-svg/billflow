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

  // Update cache (replace all)
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

  // Upsert into vendors table — insert new QB vendors, skip existing (Purchasomatic settings preserved)
  const insertRows = vendors.map(v => ({
    company_id:              companyId,
    qb_vendor_id:            v.Id,
    qb_vendor_name:          v.DisplayName,
    vendor_name_display:     v.DisplayName,
    qb_default_gl_account_id: v.DefaultExpenseAccountRef?.value ?? null,
    gl_account_source:       v.DefaultExpenseAccountRef?.value ? 'qb_default' : 'not_set',
    qb_payment_terms:        v.SalesTermRef?.name ?? null,
    payment_terms_source:    v.SalesTermRef?.name ? 'qb_default' : 'not_set',
    copy_po_to_qb_reference: true,
    is_visible:              true,
    auto_publish_enabled:    false,
    hold_for_job_match:      false,
    invoices_processed:      0,
  }))
  // ignoreDuplicates: true = INSERT ... ON CONFLICT DO NOTHING (preserves existing Purchasomatic settings)
  await supabase.from('vendors').upsert(insertRows, {
    onConflict: 'company_id,qb_vendor_id',
    ignoreDuplicates: true,
  })

  // For existing vendors, update only the QB-derived fields (name, GL, payment terms)
  for (const v of vendors) {
    await supabase.from('vendors')
      .update({
        qb_vendor_name:           v.DisplayName,
        qb_default_gl_account_id: v.DefaultExpenseAccountRef?.value ?? null,
        qb_payment_terms:         v.SalesTermRef?.name ?? null,
      })
      .eq('company_id', companyId)
      .eq('qb_vendor_id', v.Id)
  }
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
