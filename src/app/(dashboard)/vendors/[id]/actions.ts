'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updateVendor(vendorId: string, updates: Record<string, unknown>) {
  const supabase = await createClient()
  const { error } = await supabase.from('vendors').update(updates).eq('vendor_id', vendorId)
  if (error) throw new Error(error.message)
  revalidatePath(`/vendors/${vendorId}`)
  revalidatePath('/vendors')
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
