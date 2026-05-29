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
