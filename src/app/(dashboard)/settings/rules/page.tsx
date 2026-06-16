import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { CompanyRulesClient } from './CompanyRulesClient'

export default async function CompanyRulesPage() {
  const supabase = await createClient()

  const { data: company } = await supabase
    .from('companies')
    .select('company_id')
    .single()

  const [rulesResult, accountsResult] = await Promise.all([
    supabase
      .from('company_line_item_rules')
      .select('id, rule_name, match_type, conditions, gl_account_id, priority')
      .eq('company_id', company?.company_id ?? '')
      .order('priority'),
    supabase
      .from('qb_accounts_cache')
      .select('qb_account_id, name, account_type, is_hidden')
      .eq('company_id', company?.company_id ?? '')
      .in('account_type', ['Expense', 'CostOfGoodsSold', 'OtherExpense'])
      .neq('is_hidden', true)
      .order('name'),
  ])

  const rules = rulesResult.data ?? []
  const accounts = accountsResult.data ?? []

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 24px' }}>
      <div className="flex items-center gap-2" style={{ marginBottom: 4 }}>
        <Link
          href="/settings"
          style={{ fontSize: 12, color: 'var(--color-text-secondary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}
        >
          <i className="ti ti-arrow-left" style={{ fontSize: 12 }} />
          Settings
        </Link>
      </div>

      <h1 style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 4 }}>
        GL Account Rules
      </h1>
      <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 24, lineHeight: 1.5 }}>
        Rules that apply across all vendors. Vendor-specific rules always take priority over these.
      </p>

      <CompanyRulesClient rules={rules as Parameters<typeof CompanyRulesClient>[0]['rules']} accounts={accounts} />
    </div>
  )
}
