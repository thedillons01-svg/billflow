import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { VendorGLClient } from './VendorGLClient'

export default async function VendorGLPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: member } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', user.id)
    .single()

  if (!member?.company_id) redirect('/settings')

  const companyId = member.company_id

  const [{ data: vendors }, { data: accounts }] = await Promise.all([
    supabase
      .from('vendors')
      .select('vendor_id, vendor_name_display, qb_default_gl_account_id, billflow_gl_account_id')
      .eq('company_id', companyId)
      .eq('is_visible', true)
      .order('vendor_name_display'),
    supabase
      .from('qb_accounts_cache')
      .select('qb_account_id, name')
      .eq('company_id', companyId)
      .in('account_type', ['Expense', 'CostOfGoodsSold', 'OtherExpense'])
      .neq('is_hidden', true)
      .order('name'),
  ])

  return (
    <VendorGLClient
      vendors={vendors ?? []}
      accounts={accounts ?? []}
    />
  )
}
