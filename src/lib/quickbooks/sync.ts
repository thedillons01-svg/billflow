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
  DefaultExpenseAccountRef?: { value: string; name: string } // not returned by QBO Online API
  TermRef?: { value: string } // QBO only returns value (ID), not name
  Active: boolean
}

type QBCustomer = {
  Id: string
  DisplayName: string
  FullyQualifiedName: string
  ParentRef?: { value: string; name: string }
  Job: boolean
  Active: boolean
  MetaData?: { CreateTime?: string; LastUpdatedTime?: string }
}

type QBClass = {
  Id: string
  Name: string
  FullyQualifiedName: string
  Active: boolean
}

type QBTerm = {
  Id: string
  Name: string
  DueDays?: number
  Type: string
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

  const [vendors, terms] = await Promise.all([
    qbFetchAll<QBVendor>('Vendor', 'SELECT * FROM Vendor WHERE Active = true'),
    qbFetchAll<QBTerm>('Term', 'SELECT * FROM Term WHERE Active = true').catch(() => [] as QBTerm[]),
  ])
  if (vendors.length === 0) return

  // Build term ID → name lookup so we can resolve TermRef.value to a display name
  const termNameById = new Map(terms.map(t => [t.Id, t.Name]))

  const now = new Date().toISOString()

  // Upsert cache (safe for concurrent calls — no delete+insert race)
  const { error } = await supabase.from('qb_vendors_cache').upsert(
    vendors.map(v => ({
      company_id:                 companyId,
      qb_vendor_id:               v.Id,
      name:                       v.DisplayName,
      default_expense_account_id: v.DefaultExpenseAccountRef?.value ?? null,
      payment_terms:              v.TermRef?.value ? (termNameById.get(v.TermRef.value) ?? null) : null,
      cached_at:                  now,
    })),
    { onConflict: 'company_id,qb_vendor_id', ignoreDuplicates: false }
  )
  if (error) throw new Error(`Vendors cache upsert failed: ${error.message}`)

  // Insert new QB vendors (ignoreDuplicates preserves existing Purchasomatic settings)
  await supabase.from('vendors').upsert(
    vendors.map(v => {
      const termName = v.TermRef?.value ? (termNameById.get(v.TermRef.value) ?? null) : null
      return {
      company_id:               companyId,
      qb_vendor_id:             v.Id,
      qb_vendor_name:           v.DisplayName,
      vendor_name_display:      v.DisplayName,
      qb_default_gl_account_id: v.DefaultExpenseAccountRef?.value ?? null,
      gl_account_source:        v.DefaultExpenseAccountRef?.value ? 'qb_default' : 'not_set',
      qb_payment_terms:         termName,
      payment_terms_source:     termName ? 'qb_default' : 'not_set',
      copy_po_to_qb_reference:  true,
      is_visible:               true,
      auto_publish_enabled:     false,
      hold_for_job_match:       false,
      invoices_processed:       0,
    }}),
    { onConflict: 'company_id,qb_vendor_id', ignoreDuplicates: true }
  )

  // Update QB-derived value fields on existing vendors (preserves all Purchasomatic overrides)
  for (const v of vendors) {
    const termName = v.TermRef?.value ? (termNameById.get(v.TermRef.value) ?? null) : null
    await supabase.from('vendors')
      .update({
        qb_vendor_name:           v.DisplayName,
        qb_default_gl_account_id: v.DefaultExpenseAccountRef?.value ?? null,
        qb_payment_terms:         termName,
      })
      .eq('company_id', companyId)
      .eq('qb_vendor_id', v.Id)
  }

  // Conditionally update source flags — never touch 'billflow_override' or 'Purchasomatic_override'
  // GL: not_set → qb_default when QB now provides a value
  await supabase.from('vendors').update({ gl_account_source: 'qb_default' })
    .eq('company_id', companyId).not('qb_default_gl_account_id', 'is', null).eq('gl_account_source', 'not_set')
  // GL: qb_default → not_set when QB removed the value
  await supabase.from('vendors').update({ gl_account_source: 'not_set' })
    .eq('company_id', companyId).is('qb_default_gl_account_id', null).eq('gl_account_source', 'qb_default')
  // Payment terms: not_set → qb_default
  await supabase.from('vendors').update({ payment_terms_source: 'qb_default' })
    .eq('company_id', companyId).not('qb_payment_terms', 'is', null).eq('payment_terms_source', 'not_set')
  // Payment terms: qb_default → not_set
  await supabase.from('vendors').update({ payment_terms_source: 'not_set' })
    .eq('company_id', companyId).is('qb_payment_terms', null).eq('payment_terms_source', 'qb_default')

  // Infer GL account from recent QB bill history for vendors with no GL set
  const noGlVendorIds = vendors
    .filter(v => !v.DefaultExpenseAccountRef?.value)
    .map(v => v.Id)
  await inferVendorGLFromHistory(companyId, noGlVendorIds).catch(() => {})
}

// Refresh all vendors from QB if cache is stale. Rate-limited to prevent stampede
// when multiple invoices process simultaneously. Called during initial invoice processing.
export async function syncVendorsIfStale(companyId: string, maxAgeMinutes = 30): Promise<void> {
  const supabase = createServiceClient()

  const { data: latest } = await supabase
    .from('qb_vendors_cache')
    .select('cached_at')
    .eq('company_id', companyId)
    .order('cached_at', { ascending: false })
    .limit(1)
    .single()

  if (latest?.cached_at) {
    const ageMs = Date.now() - new Date(latest.cached_at).getTime()
    if (ageMs < maxAgeMinutes * 60 * 1000) return
  }

  try {
    await Promise.all([
      syncVendors(companyId),
      syncTerms(companyId),
    ])
  } catch {
    // Non-fatal — processing continues with cached data
  }
}

// Refresh a single vendor from QB. Always runs — used before reprocess so changes
// made in QB (e.g. setting a default expense account) are picked up immediately.
export async function syncSingleVendorFromQB(companyId: string, qbVendorId: string): Promise<void> {
  const supabase = createServiceClient()
  try {
    const { qbFetchAll } = await getQBClient(companyId)
    const vendors = await qbFetchAll<QBVendor>(
      'Vendor',
      `SELECT * FROM Vendor WHERE Id = '${qbVendorId}'`
    )
    if (vendors.length === 0) return
    const v = vendors[0]
    const now = new Date().toISOString()

    // Look up term name by ID from cache
    const { data: termRow } = v.TermRef?.value
      ? await supabase.from('qb_terms_cache').select('name').eq('company_id', companyId).eq('qb_term_id', v.TermRef.value).single()
      : { data: null }

    await supabase.from('qb_vendors_cache').upsert({
      company_id:                 companyId,
      qb_vendor_id:               v.Id,
      name:                       v.DisplayName,
      default_expense_account_id: v.DefaultExpenseAccountRef?.value ?? null,
      payment_terms:              termRow?.name ?? null,
      cached_at:                  now,
    }, { onConflict: 'company_id,qb_vendor_id', ignoreDuplicates: false })

    const qbGl    = v.DefaultExpenseAccountRef?.value ?? null
    const qbTerms = termRow?.name ?? null

    await supabase.from('vendors')
      .update({
        qb_vendor_name:           v.DisplayName,
        qb_default_gl_account_id: qbGl,
        qb_payment_terms:         qbTerms,
      })
      .eq('company_id', companyId)
      .eq('qb_vendor_id', v.Id)

    // Conditionally update source flags — never overwrite 'billflow_override'
    if (qbGl) {
      await supabase.from('vendors').update({ gl_account_source: 'qb_default' })
        .eq('company_id', companyId).eq('qb_vendor_id', v.Id).eq('gl_account_source', 'not_set')
    } else {
      await supabase.from('vendors').update({ gl_account_source: 'not_set' })
        .eq('company_id', companyId).eq('qb_vendor_id', v.Id).eq('gl_account_source', 'qb_default')
    }
    if (qbTerms) {
      await supabase.from('vendors').update({ payment_terms_source: 'qb_default' })
        .eq('company_id', companyId).eq('qb_vendor_id', v.Id).eq('payment_terms_source', 'not_set')
    } else {
      await supabase.from('vendors').update({ payment_terms_source: 'not_set' })
        .eq('company_id', companyId).eq('qb_vendor_id', v.Id).eq('payment_terms_source', 'qb_default')
    }
  } catch {
    // Non-fatal
  }
}

// Build a cache row from a QB customer. Works for both top-level customers and sub-customers.
function buildJobRow(companyId: string, c: QBCustomer, statusMap: Map<string, string>): Record<string, unknown> {
  const isCustomer = !c.ParentRef
  const parts = c.FullyQualifiedName.split(':')
  // For top-level customers: job_name = their own name, customer_name = ''
  // For sub-customers: job_name = last segment, customer_name = everything before
  const jobName = parts[parts.length - 1]
  const customerName = parts.length > 1 ? parts.slice(0, -1).join(':') : ''
  const jobNumberMatch = jobName.match(/\b(\d+)\b/)
  return {
    company_id:    companyId,
    qb_job_id:     c.Id,
    job_name:      jobName,
    job_number:    jobNumberMatch?.[1] ?? null,
    customer_name: customerName,
    customer_id:   c.ParentRef?.value ?? null,
    parent_id:     c.ParentRef?.value ?? null,
    is_customer:   isCustomer,
    // Preserve user-set status; new entries default to 'active'
    status:        statusMap.get(c.Id) ?? 'active',
    qb_created_at: c.MetaData?.CreateTime ?? null,
    qb_updated_at: c.MetaData?.LastUpdatedTime ?? null,
    cached_at:     new Date().toISOString(),
  }
}

export async function syncJobs(companyId: string) {
  const supabase = createServiceClient()
  const { qbFetchAll } = await getQBClient(companyId)

  const allCustomers = await qbFetchAll<QBCustomer>(
    'Customer',
    'SELECT * FROM Customer WHERE Active = true'
  )
  if (allCustomers.length === 0) return

  // Preserve user-set status values before upserting
  const { data: existing } = await supabase
    .from('qb_jobs_cache')
    .select('qb_job_id, status')
    .eq('company_id', companyId)
  const statusMap = new Map((existing ?? []).map(r => [r.qb_job_id, r.status as string]))

  const rows = allCustomers.map(c => buildJobRow(companyId, c, statusMap))

  const { error } = await supabase.from('qb_jobs_cache').upsert(rows, {
    onConflict: 'company_id,qb_job_id',
    ignoreDuplicates: false,
  })
  if (error) throw new Error(`Jobs cache upsert failed: ${error.message}`)
}

export async function closeInactiveJobs(companyId: string): Promise<void> {
  const supabase = createServiceClient()

  const { data: company } = await supabase
    .from('companies')
    .select('auto_close_jobs_days')
    .eq('company_id', companyId)
    .single()

  const days = company?.auto_close_jobs_days
  if (!days || days <= 0) return

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const cutoffIso = cutoff.toISOString()

  // Fetch active jobs including their QB dates
  const { data: activeJobs } = await supabase
    .from('qb_jobs_cache')
    .select('qb_job_id, qb_created_at, qb_updated_at')
    .eq('company_id', companyId)
    .eq('status', 'active')
    .eq('is_customer', false)

  if (!activeJobs?.length) return

  const inactiveIds: string[] = []

  for (const job of activeJobs) {
    // If QB says the job was created or updated recently, keep it active
    if (job.qb_created_at && job.qb_created_at > cutoffIso) continue
    if (job.qb_updated_at && job.qb_updated_at > cutoffIso) continue

    // Check Purchasomatic activity: bills or POs tagged to this job
    const [{ data: billLines }, { data: poLines }] = await Promise.all([
      supabase.from('bill_line_items').select('line_id')
        .eq('company_id', companyId).eq('job_id', job.qb_job_id)
        .gte('created_at', cutoffIso).limit(1),
      supabase.from('po_line_items').select('line_id')
        .eq('company_id', companyId).eq('job_id', job.qb_job_id)
        .gte('created_at', cutoffIso).limit(1),
    ])

    if (!billLines?.length && !poLines?.length) {
      inactiveIds.push(job.qb_job_id)
    }
  }

  if (inactiveIds.length > 0) {
    await supabase.from('qb_jobs_cache')
      .update({ status: 'closed' })
      .eq('company_id', companyId)
      .in('qb_job_id', inactiveIds)
  }
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

// Refresh the jobs cache from QB only if it's stale (> maxAgeMinutes old).
// Called as a fallback during invoice processing when a job isn't found in cache.
// Using upsert (not delete+insert) so concurrent calls from simultaneous invoices are safe.
export async function syncJobsIfStale(companyId: string, maxAgeMinutes = 5): Promise<void> {
  const supabase = createServiceClient()

  const { data: latest } = await supabase
    .from('qb_jobs_cache')
    .select('cached_at')
    .eq('company_id', companyId)
    .order('cached_at', { ascending: false })
    .limit(1)
    .single()

  if (latest?.cached_at) {
    const ageMs = Date.now() - new Date(latest.cached_at).getTime()
    if (ageMs < maxAgeMinutes * 60 * 1000) return
  }

  try {
    const { qbFetchAll } = await getQBClient(companyId)
    const allCustomers = await qbFetchAll<QBCustomer>(
      'Customer',
      'SELECT * FROM Customer WHERE Active = true'
    )
    if (allCustomers.length === 0) return

    const { data: existing } = await supabase
      .from('qb_jobs_cache')
      .select('qb_job_id, status')
      .eq('company_id', companyId)
    const statusMap = new Map((existing ?? []).map(r => [r.qb_job_id, r.status as string]))

    const rows = allCustomers.map(c => buildJobRow(companyId, c, statusMap))
    await supabase.from('qb_jobs_cache').upsert(rows, {
      onConflict: 'company_id,qb_job_id',
      ignoreDuplicates: false,
    })
  } catch {
    // Non-fatal — bill stays in pending_job_match for manual assignment
  }
}

type QBBill = {
  Id: string
  VendorRef?: { value: string }
  Line?: Array<{
    DetailType?: string
    AccountBasedExpenseLineDetail?: { AccountRef?: { value: string; name: string } }
  }>
}

// Infer default GL account from recent QB bill history for vendors with no GL set.
// Queries the 100 most recent bills and finds the most common AccountRef per vendor.
async function inferVendorGLFromHistory(companyId: string, vendorIds: string[]): Promise<void> {
  if (vendorIds.length === 0) return
  const supabase = createServiceClient()
  const { qbFetchAll } = await getQBClient(companyId)

  let bills: QBBill[]
  try {
    bills = await qbFetchAll<QBBill>(
      'Bill',
      'SELECT * FROM Bill ORDERBY MetaData.LastUpdatedTime DESC MAXRESULTS 100'
    )
  } catch {
    return
  }

  // Group account refs by vendor, count occurrences
  const vendorAccountCounts = new Map<string, Map<string, number>>()
  for (const bill of bills) {
    const vendorId = bill.VendorRef?.value
    if (!vendorId || !vendorIds.includes(vendorId)) continue
    for (const line of bill.Line ?? []) {
      if (line.DetailType !== 'AccountBasedExpenseLineDetail') continue
      const accountId = line.AccountBasedExpenseLineDetail?.AccountRef?.value
      if (!accountId) continue
      if (!vendorAccountCounts.has(vendorId)) vendorAccountCounts.set(vendorId, new Map())
      const counts = vendorAccountCounts.get(vendorId)!
      counts.set(accountId, (counts.get(accountId) ?? 0) + 1)
    }
  }

  // For each vendor, pick the most common account and update
  for (const [qbVendorId, counts] of vendorAccountCounts) {
    const topAccount = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
    if (!topAccount) continue
    await supabase.from('vendors')
      .update({ qb_default_gl_account_id: topAccount, gl_account_source: 'qb_default' })
      .eq('company_id', companyId)
      .eq('qb_vendor_id', qbVendorId)
      .is('qb_default_gl_account_id', null)
      .neq('gl_account_source', 'billflow_override')
  }
}

export async function syncTerms(companyId: string) {
  const supabase = createServiceClient()
  const { qbFetchAll } = await getQBClient(companyId)

  let terms: QBTerm[]
  try {
    terms = await qbFetchAll<QBTerm>('Term', 'SELECT * FROM Term WHERE Active = true')
  } catch {
    return
  }
  if (terms.length === 0) return

  const { error } = await supabase.from('qb_terms_cache').upsert(
    terms.map(t => ({
      company_id: companyId,
      qb_term_id: t.Id,
      name:       t.Name,
      due_days:   t.Type === 'STANDARD' ? (t.DueDays ?? null) : null,
      type:       t.Type,
      cached_at:  new Date().toISOString(),
    })),
    { onConflict: 'company_id,qb_term_id', ignoreDuplicates: false }
  )
  if (error) throw new Error(`Terms cache upsert failed: ${error.message}`)
}

type QBItem = {
  Id: string
  Name: string
  Type: string
  Active: boolean
}

export async function syncItems(companyId: string) {
  const supabase = createServiceClient()
  const { qbFetchAll } = await getQBClient(companyId)

  let items: QBItem[]
  try {
    items = await qbFetchAll<QBItem>('Item', 'SELECT * FROM Item WHERE Active = true')
  } catch {
    return
  }
  if (items.length === 0) return

  const { error } = await supabase.from('qb_items_cache').upsert(
    items.map(i => ({
      company_id: companyId,
      qb_item_id: i.Id,
      name:       i.Name,
      item_type:  i.Type,
      active:     i.Active,
      cached_at:  new Date().toISOString(),
    })),
    { onConflict: 'company_id,qb_item_id', ignoreDuplicates: false }
  )
  if (error) throw new Error(`Items cache upsert failed: ${error.message}`)
}

export async function syncAll(companyId: string) {
  // Clear all QB cache tables before syncing so stale data from a previously
  // connected QB company (e.g. sandbox) doesn't persist alongside new results.
  const supabaseClean = createServiceClient()
  await Promise.all([
    supabaseClean.from('qb_accounts_cache').delete().eq('company_id', companyId),
    supabaseClean.from('qb_vendors_cache').delete().eq('company_id', companyId),
    supabaseClean.from('qb_jobs_cache').delete().eq('company_id', companyId),
    supabaseClean.from('qb_classes_cache').delete().eq('company_id', companyId),
    supabaseClean.from('qb_terms_cache').delete().eq('company_id', companyId),
    supabaseClean.from('qb_items_cache').delete().eq('company_id', companyId),
  ])

  await Promise.all([
    syncAccounts(companyId),
    syncVendors(companyId),
    syncJobs(companyId),
    syncClasses(companyId).catch(() => {}),
    syncTerms(companyId).catch(() => {}),
    syncItems(companyId).catch(() => {}),
  ])
  await closeInactiveJobs(companyId).catch(() => {})

  const supabase = createServiceClient()
  await supabase
    .from('companies')
    .update({ qb_last_sync: new Date().toISOString() })
    .eq('company_id', companyId)
}
