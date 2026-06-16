'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function saveCompanyRule(rule: {
  rule_name: string
  match_type: string
  conditions: unknown[]
  gl_account_id: string
}) {
  const supabase = await createClient()
  const { data: company } = await supabase.from('companies').select('company_id').single()
  if (!company) return null

  const { data: maxPriority } = await supabase
    .from('company_line_item_rules')
    .select('priority')
    .eq('company_id', company.company_id)
    .order('priority', { ascending: false })
    .limit(1)

  const priority = (maxPriority?.[0]?.priority ?? -1) + 1

  const { data, error } = await supabase
    .from('company_line_item_rules')
    .insert({
      company_id:    company.company_id,
      rule_name:     rule.rule_name,
      match_type:    rule.match_type,
      conditions:    rule.conditions,
      gl_account_id: rule.gl_account_id || null,
      priority,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  revalidatePath('/settings/rules')
  return data
}

export async function deleteCompanyRule(id: string) {
  const supabase = await createClient()
  await supabase.from('company_line_item_rules').delete().eq('id', id)
  revalidatePath('/settings/rules')
}
