'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { revalidatePath } from 'next/cache'
import { getQBClient } from '@/lib/quickbooks/client'
import { applyCustomerClassToLines } from '@/lib/ocr/process'

export async function updateVendor(vendorId: string, updates: Record<string, unknown>) {
  const supabase = await createClient()
  const { error } = await supabase.from('vendors').update(updates).eq('vendor_id', vendorId)
  if (error) throw new Error(error.message)
  revalidatePath(`/vendors/${vendorId}`)
  revalidatePath('/vendors')
}

export async function createVendorInQB(
  vendorId: string
): Promise<{ qbVendorId: string; qbVendorName: string } | { error: string }> {
  const supabase = await createClient()
  const { data: vendor } = await supabase
    .from('vendors')
    .select('company_id, vendor_name_display, vendor_name_extracted')
    .eq('vendor_id', vendorId)
    .single()
  if (!vendor) return { error: 'Vendor not found' }

  const displayName = (vendor.vendor_name_display ?? vendor.vendor_name_extracted ?? '').trim()
  if (!displayName) return { error: 'Vendor has no name to use in QuickBooks' }

  let qbVendorId: string
  let qbVendorName: string = displayName

  try {
    const { qbPost } = await getQBClient(vendor.company_id)
    try {
      const result = await qbPost('vendor', { DisplayName: displayName })
      qbVendorId = result.Vendor?.Id
      qbVendorName = result.Vendor?.DisplayName ?? displayName
      if (!qbVendorId) return { error: 'QuickBooks did not return a vendor ID' }
    } catch (e) {
      // QB error 6240 = duplicate name — extract existing vendor ID and link to it
      const msg = e instanceof Error ? e.message : ''
      const dupMatch = msg.match(/"code":"6240"[\s\S]*?Id=(\d+)/)
      if (dupMatch) {
        qbVendorId = dupMatch[1]
      } else {
        throw e
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : ''
    return {
      error: msg.includes('not connected')
        ? 'QuickBooks is not connected. Connect QuickBooks in Settings before creating vendors.'
        : `Could not create vendor in QuickBooks: ${msg || 'unknown error'}`,
    }
  }

  await supabase.from('vendors').update({
    qb_vendor_id: qbVendorId,
    qb_vendor_name: qbVendorName,
    vendor_name_display: qbVendorName,
  }).eq('vendor_id', vendorId)

  // Upsert so re-linking an existing QB vendor doesn't fail on duplicate cache entry
  await supabase.from('qb_vendors_cache').upsert(
    { company_id: vendor.company_id, qb_vendor_id: qbVendorId, name: qbVendorName, cached_at: new Date().toISOString() },
    { onConflict: 'company_id,qb_vendor_id' }
  )

  revalidatePath(`/vendors/${vendorId}`)
  revalidatePath('/vendors')
  return { qbVendorId, qbVendorName }
}

type RuleRow = {
  match_type: string
  conditions: Array<{ field: string; operator: string; value: string }>
  gl_account_id: string | null
}

function evaluateRule(
  rule: { match_type: string; conditions: Array<{ field: string; operator: string; value: string }> },
  description: string,
  unitPrice: number,
): boolean {
  const results = rule.conditions.map(cond => {
    const haystack = cond.field === 'description' ? description.toLowerCase() : String(unitPrice)
    const needle = cond.value.toLowerCase()
    switch (cond.operator) {
      case 'equal':       return haystack === needle
      case 'contains':    return haystack.includes(needle)
      case 'begins_with': return haystack.startsWith(needle)
      case 'ends_with':   return haystack.endsWith(needle)
      default:            return false
    }
  })
  return rule.match_type === 'all' ? results.every(Boolean) : results.some(Boolean)
}

// Apply a vendor default field to existing unpublished bills.
// mode='blank_only'     → only fill fields that are currently null
// mode='all_unpublished' → overwrite everything (rules still take priority over vendor default for GL)
export async function applyVendorDefaultToBills(
  vendorId: string,
  field: 'gl_account' | 'class' | 'description' | 'payment_account' | 'payment_method',
  mode: 'blank_only' | 'all_unpublished',
): Promise<{ count: number }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { count: 0 }

  const service = createServiceClient()

  const { data: vendor } = await service
    .from('vendors')
    .select('company_id, billflow_gl_account_id, qb_default_gl_account_id, billflow_class_id, default_description, default_payment_account_id, default_payment_method')
    .eq('vendor_id', vendorId)
    .single()
  if (!vendor) return { count: 0 }

  const { data: bills } = await service
    .from('bills')
    .select('bill_id')
    .eq('vendor_id', vendorId)
    .is('deleted_at', null)
    .neq('status', 'published')
    .neq('status', 'publishing')

  if (!bills?.length) return { count: 0 }
  const billIds = (bills as Array<{ bill_id: string }>).map(b => b.bill_id)

  // ── GL account (line-item level, rules evaluated) ────────────────────────
  if (field === 'gl_account') {
    const glAccountId = ((vendor.billflow_gl_account_id ?? vendor.qb_default_gl_account_id) as string | null)
    if (!glAccountId) return { count: 0 }

    const [{ data: vendorMappings }, { data: vendorRules }, { data: companyRules }] = await Promise.all([
      service.from('vendor_line_item_mappings').select('description_text, gl_account_id').eq('vendor_id', vendorId),
      service.from('vendor_line_item_rules').select('match_type, conditions, gl_account_id, priority').eq('vendor_id', vendorId).order('priority'),
      service.from('company_line_item_rules').select('match_type, conditions, gl_account_id, priority').eq('company_id', vendor.company_id as string).order('priority'),
    ])

    let lineQuery = service
      .from('bill_line_items')
      .select('line_id, description, unit_cost')
      .in('bill_id', billIds)
    if (mode === 'blank_only') lineQuery = lineQuery.is('gl_account_id', null)
    const { data: lines } = await lineQuery
    if (!lines?.length) return { count: 0 }

    // Group lines by their computed (gl_account_id, source) to batch updates
    const groups = new Map<string, string[]>()
    for (const line of lines as Array<{ line_id: string; description: string | null; unit_cost: number | null }>) {
      const desc = line.description ?? ''
      const unitCost = (line.unit_cost as number) ?? 0
      let resultGl: string | null = null
      let resultSource = 'vendor_default'

      // 1. Stored mapping
      const mapping = (vendorMappings ?? []).find(m => m.description_text.toLowerCase() === desc.toLowerCase())
      if (mapping?.gl_account_id) { resultGl = mapping.gl_account_id as string; resultSource = 'stored_mapping' }

      // 2. Vendor rules override mapping
      const vendorRule = (vendorRules as RuleRow[] ?? []).find(r => evaluateRule(r, desc, unitCost))
      if (vendorRule?.gl_account_id) { resultGl = vendorRule.gl_account_id as string; resultSource = 'rule' }

      // 3. Company rules if no vendor match yet
      if (!resultGl) {
        const companyRule = (companyRules as RuleRow[] ?? []).find(r => evaluateRule(r, desc, unitCost))
        if (companyRule?.gl_account_id) { resultGl = companyRule.gl_account_id as string; resultSource = 'rule' }
      }

      // 4. Vendor default
      if (!resultGl) { resultGl = glAccountId; resultSource = 'vendor_default' }

      const key = `${resultGl}|${resultSource}`
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(line.line_id as string)
    }

    for (const [key, lineIds] of groups) {
      const [gl, src] = key.split('|')
      await service.from('bill_line_items')
        .update({ gl_account_id: gl, gl_account_source: src })
        .in('line_id', lineIds)
    }

    // Recompute draft ↔ ready for each affected bill now that GL accounts are filled
    for (const billId of billIds) {
      const { data: b } = await service
        .from('bills')
        .select('status, vendor_id, total, bill_line_items(gl_account_id, extended_cost)')
        .eq('bill_id', billId)
        .single()
      if (!b || !['draft', 'ready'].includes(b.status as string)) continue
      const ls = (b.bill_line_items ?? []) as { gl_account_id: string | null; extended_cost: number | null }[]
      const hasVendor = b.vendor_id != null
      const allGL = ls.length > 0 && ls.every(l => l.gl_account_id != null)
      const lineSum = ls.reduce((s, l) => s + (l.extended_cost ?? 0), 0)
      const totalsMatch = b.total == null || Math.abs(lineSum - (b.total as number)) <= 0.01
      const correct = hasVendor && allGL && totalsMatch ? 'ready' : 'draft'
      if (correct !== b.status) {
        await service.from('bills').update({ status: correct }).eq('bill_id', billId)
      }
    }

    return { count: billIds.length }
  }

  // ── Class (line-item level) ───────────────────────────────────────────────
  if (field === 'class') {
    const classId = vendor.billflow_class_id as string | null
    if (!classId) return { count: 0 }
    let q = service.from('bill_line_items').update({ class_id: classId }).in('bill_id', billIds)
    if (mode === 'blank_only') q = q.is('class_id', null)
    await q
    return { count: billIds.length }
  }

  // ── Bill header fields ────────────────────────────────────────────────────
  const colMap: Record<string, string> = {
    description:     'description',
    payment_account: 'payment_account_id',
    payment_method:  'payment_method',
  }
  const valMap: Record<string, unknown> = {
    description:     vendor.default_description,
    payment_account: vendor.default_payment_account_id,
    payment_method:  vendor.default_payment_method,
  }
  const col = colMap[field]
  const val = valMap[field]
  if (!col || !val) return { count: 0 }

  let q = service.from('bills').update({ [col]: val }).in('bill_id', billIds)
  if (mode === 'blank_only') q = q.is(col, null)
  await q
  return { count: billIds.length }
}

// Apply customer-derived class to all unpublished bills matched to the given customers.
// Called from class setup page after user confirms apply prompt.
export async function applyCustomerClassToBills(
  companyId: string,
  customerQbJobIds: string[],
): Promise<{ count: number }> {
  if (!customerQbJobIds.length) return { count: 0 }
  const service = createServiceClient()

  const { data: bills } = await service
    .from('bills')
    .select('bill_id, matched_customer_qb_id')
    .eq('company_id', companyId)
    .is('deleted_at', null)
    .neq('status', 'published')
    .neq('status', 'archived')
    .neq('status', 'rejected')
    .in('matched_customer_qb_id', customerQbJobIds)

  if (!bills?.length) return { count: 0 }

  let count = 0
  for (const bill of bills as Array<{ bill_id: string; matched_customer_qb_id: string | null }>) {
    // Prefer a job_id from line items for class lookup (it walks up to customer if no direct class)
    const { data: lineWithJob } = await service
      .from('bill_line_items')
      .select('job_id')
      .eq('bill_id', bill.bill_id)
      .not('job_id', 'is', null)
      .limit(1)
      .maybeSingle()

    const jobId = (lineWithJob?.job_id ?? bill.matched_customer_qb_id) as string | null
    if (!jobId) continue
    await applyCustomerClassToLines(service, bill.bill_id, companyId, jobId)
    count++
  }
  return { count }
}

export async function deleteMapping(id: string) {
  const supabase = await createClient()
  await supabase.from('vendor_line_item_mappings').delete().eq('id', id)
  revalidatePath('/vendors')
}

export async function saveRule(
  vendorId: string,
  rule: { rule_name: string; match_type: string; conditions: unknown[]; gl_account_id: string }
) {
  const supabase = await createClient()
  const { data: vendor } = await supabase
    .from('vendors')
    .select('company_id')
    .eq('vendor_id', vendorId)
    .single()

  if (!vendor) return null

  const { data: maxPriority } = await supabase
    .from('vendor_line_item_rules')
    .select('priority')
    .eq('vendor_id', vendorId)
    .order('priority', { ascending: false })
    .limit(1)

  const priority = (maxPriority?.[0]?.priority ?? -1) + 1

  const { data, error } = await supabase
    .from('vendor_line_item_rules')
    .insert({
      vendor_id:    vendorId,
      company_id:   vendor.company_id,
      rule_name:    rule.rule_name,
      match_type:   rule.match_type,
      conditions:   rule.conditions,
      gl_account_id: rule.gl_account_id || null,
      priority,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  revalidatePath(`/vendors/${vendorId}`)
  return data
}

export async function deleteRule(id: string) {
  const supabase = await createClient()
  await supabase.from('vendor_line_item_rules').delete().eq('id', id)
  revalidatePath('/vendors')
}
