'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getQBClient } from '@/lib/quickbooks/client'

export async function updateVendor(vendorId: string, updates: Record<string, unknown>) {
  const supabase = await createClient()
  const { error } = await supabase.from('vendors').update(updates).eq('vendor_id', vendorId)
  if (error) throw new Error(error.message)
  revalidatePath(`/vendors/${vendorId}`)
  revalidatePath('/vendors')
}

export async function createVendorInQB(vendorId: string) {
  const supabase = await createClient()
  const { data: vendor } = await supabase
    .from('vendors')
    .select('company_id, vendor_name_display, vendor_name_extracted')
    .eq('vendor_id', vendorId)
    .single()
  if (!vendor) throw new Error('Vendor not found')

  const displayName = (vendor.vendor_name_display ?? vendor.vendor_name_extracted ?? '').trim()
  if (!displayName) throw new Error('Vendor has no name to use in QuickBooks')

  const { qbPost } = await getQBClient(vendor.company_id)
  const result = await qbPost('vendor', { DisplayName: displayName })
  const qbVendorId: string = result.Vendor?.Id
  const qbVendorName: string = result.Vendor?.DisplayName ?? displayName
  if (!qbVendorId) throw new Error('QuickBooks did not return a vendor ID')

  await supabase.from('vendors').update({
    qb_vendor_id: qbVendorId,
    qb_vendor_name: qbVendorName,
    vendor_name_display: qbVendorName,
  }).eq('vendor_id', vendorId)

  // Add to cache so the QB vendor dropdown shows it immediately
  await supabase.from('qb_vendors_cache').insert({
    company_id: vendor.company_id,
    qb_vendor_id: qbVendorId,
    name: qbVendorName,
    cached_at: new Date().toISOString(),
  }).throwOnError()

  revalidatePath(`/vendors/${vendorId}`)
  revalidatePath('/vendors')
  return { qbVendorId, qbVendorName }
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
