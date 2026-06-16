import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { formatDateOnly } from '@/lib/utils/date'
import { VendorGeneralTab } from './vendor-general-tab'
import { VendorLineItemsTab } from './vendor-line-items-tab'
import { VendorRulesTab } from './vendor-rules-tab'
import { VendorPageClient } from './vendor-page-client'

export default async function VendorDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string; from?: string }>
}) {
  const { id } = await params
  const { tab = 'general', from } = await searchParams

  const supabase = await createClient()

  const { data: vendor } = await supabase
    .from('vendors')
    .select('*')
    .eq('vendor_id', id)
    .single()

  if (!vendor) notFound()

  // QB accounts for GL account and payment account dropdowns
  const [{ data: accounts }, { data: classes }, { data: companyCfg }, { data: qbVendors }, { data: qbTerms }] = await Promise.all([
    supabase
      .from('qb_accounts_cache')
      .select('qb_account_id, name, account_type')
      .in('account_type', ['Expense', 'Cost of Goods Sold', 'OtherCurrentLiability', 'Bank', 'CreditCard'])
      .eq('is_hidden', false)
      .order('name'),
    supabase
      .from('qb_classes_cache')
      .select('qb_class_id, name')
      .eq('is_hidden', false)
      .order('name'),
    supabase
      .from('companies')
      .select('class_tracking_enabled')
      .single(),
    supabase
      .from('qb_vendors_cache')
      .select('qb_vendor_id, name')
      .eq('company_id', vendor.company_id)
      .order('name'),
    supabase
      .from('qb_terms_cache')
      .select('qb_term_id, name, due_days, type')
      .eq('company_id', vendor.company_id)
      .order('name'),
  ])

  const expenseAccounts = (accounts ?? []).filter(a =>
    ['Expense', 'Cost of Goods Sold', 'OtherCurrentLiability'].includes(a.account_type ?? '')
  )

  // Line item mappings
  const { data: mappings } = await supabase
    .from('vendor_line_item_mappings')
    .select('id, description_text, gl_account_id, created_at')
    .eq('vendor_id', id)
    .order('created_at', { ascending: false })

  // Rules
  const { data: rules } = await supabase
    .from('vendor_line_item_rules')
    .select('id, rule_name, match_type, conditions, gl_account_id, priority')
    .eq('vendor_id', id)
    .order('priority')

  // Inbox bills
  const { data: inboxBills } = await supabase
    .from('bills')
    .select('bill_id, invoice_number, invoice_date, total, status, autopublish_hold_reason')
    .eq('vendor_id', id)
    .not('status', 'eq', 'published')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(20)

  // Archived bills
  const { data: archivedBills } = await supabase
    .from('bills')
    .select('bill_id, invoice_number, invoice_date, total, status')
    .eq('vendor_id', id)
    .eq('status', 'published')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(50)

  const tabs = [
    { id: 'general',    label: 'General' },
    { id: 'line-items', label: 'Line Items' },
    { id: 'rules',      label: 'Rules' },
    { id: 'inbox',      label: 'Inbox', count: inboxBills?.length ?? 0 },
    { id: 'archived',   label: 'Archived' },
  ]

  return (
    <VendorPageClient
      vendorName={vendor.vendor_name_display ?? vendor.vendor_name_extracted ?? ''}
      ocrName={vendor.vendor_name_display ? vendor.vendor_name_extracted : null}
      id={id}
      tabs={tabs}
      currentTab={tab}
      from={from}
    >
      {tab === 'general' && (
        <VendorGeneralTab
          vendor={vendor}
          accounts={accounts ?? []}
          classes={classes ?? []}
          classTrackingEnabled={companyCfg?.class_tracking_enabled ?? false}
          qbVendors={qbVendors ?? []}
          qbTerms={(qbTerms ?? []) as { qb_term_id: string; name: string; due_days: number | null; type: string }[]}
        />
      )}
      {tab === 'line-items' && (
        <VendorLineItemsTab vendorId={id} mappings={mappings ?? []} accounts={expenseAccounts} />
      )}
      {tab === 'rules' && (
        <VendorRulesTab vendorId={id} rules={rules ?? []} accounts={expenseAccounts} />
      )}
      {tab === 'inbox' && (
        <BillListTab bills={inboxBills ?? []} empty="No bills in inbox for this vendor." />
      )}
      {tab === 'archived' && (
        <BillListTab bills={archivedBills ?? []} empty="No archived bills for this vendor." />
      )}
    </VendorPageClient>
  )
}

const STATUS_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  draft:             { bg: '#FEF3C7', color: '#92400E', label: 'Needs Review' },
  ready:             { bg: '#D1FAE5', color: '#065F46', label: 'Ready' },
  sync_error:        { bg: '#FEE2E2', color: '#991B1B', label: 'Sync Error' },
  pending_job_match: { bg: '#EDE9FE', color: '#5B21B6', label: 'Pending' },
  published:         { bg: '#D1FAE5', color: '#065F46', label: 'Published' },
}

function BillListTab({ bills, empty }: { bills: { bill_id: string; invoice_number: string | null; invoice_date: string | null; total: number | null; status: string; autopublish_hold_reason?: string | null }[]; empty: string }) {
  if (bills.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <i className="ti ti-file-invoice" style={{ fontSize: 36, color: 'var(--color-text-tertiary)' }} />
        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 12 }}>{empty}</p>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 700 }}>
      {bills.map((bill, i) => {
        const badge = STATUS_BADGE[bill.status] ?? STATUS_BADGE.draft
        return (
          <Link
            key={bill.bill_id}
            href={`/bills/${bill.bill_id}`}
            className="flex items-center justify-between py-3 px-4"
            style={{
              background: i % 2 === 0 ? 'white' : 'var(--color-background-secondary)',
              border: '0.5px solid var(--color-border-tertiary)',
              borderTop: i === 0 ? '0.5px solid var(--color-border-tertiary)' : 'none',
              textDecoration: 'none',
              display: 'flex',
            }}
          >
            <div>
              <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>
                {bill.invoice_number ?? '—'}
              </p>
              {bill.autopublish_hold_reason && (
                <p style={{ fontSize: 11, color: '#D97706' }}>{bill.autopublish_hold_reason}</p>
              )}
              <p style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
                {formatDateOnly(bill.invoice_date)}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span style={{ fontSize: 13, color: 'var(--color-text-primary)' }}>
                {bill.total != null ? `$${Number(bill.total).toFixed(2)}` : '—'}
              </span>
              <span style={{ background: badge.bg, color: badge.color, borderRadius: 4, padding: '3px 8px', fontSize: 10, fontWeight: 500 }}>
                {badge.label}
              </span>
            </div>
          </Link>
        )
      })}
    </div>
  )
}
