import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { BillsList } from './bills-list'
import { BillsRealtime } from './bills-realtime'
import { UploadButton } from './upload-button'

// Needs Review: bills with actual problems requiring user action
const REVIEW_STATUSES = ['draft', 'sync_error', 'ocr_error', 'fingerprint_duplicate']
const PENDING_STATUSES = ['pending_job_match']
const ARCHIVE_STATUSES = ['published']
const ALL_INBOX_STATUSES = [...REVIEW_STATUSES, 'ready', ...PENDING_STATUSES, 'publishing']

export default async function BillsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string; status?: string; _t?: string }>
}) {
  const { tab, q, status: statusFilter } = await searchParams
  const activeTab = tab === 'review' ? 'review' : tab === 'pending' ? 'pending' : tab === 'archive' ? 'archive' : 'all'
  const search = q?.trim() ?? ''

  const supabase = await createClient()

  // ?status=sync_error (from the home page sync error alert) overrides tab filtering
  let statuses: string[]
  if (statusFilter) {
    statuses = [statusFilter]
  } else if (activeTab === 'review') statuses = REVIEW_STATUSES
  else if (activeTab === 'pending') statuses = PENDING_STATUSES
  else if (activeTab === 'all') statuses = ALL_INBOX_STATUSES
  else statuses = ARCHIVE_STATUSES

  let query = supabase
    .from('bills')
    .select('bill_id, vendor_id, vendor_name_raw, invoice_number, invoice_date, total, status, autopublish_hold_reason, mark_as_paid, published_at, bill_line_items(gl_account_id, job_id), vendors!bills_vendor_id_fkey(vendor_name_display)')
    .in('status', statuses)
    .is('deleted_at', null)
    .order('created_at', { ascending: activeTab === 'archive' })

  if (search && activeTab === 'archive') {
    query = query.or(`vendor_name_raw.ilike.%${search}%,invoice_number.ilike.%${search}%`)
  }

  const [billsResult, allInboxCountResult, reviewCountResult, pendingCountResult, accountsResult, jobsResult, companyResult] = await Promise.all([
    query.limit(activeTab === 'archive' ? 200 : 500),
    supabase.from('bills').select('*', { count: 'exact', head: true }).in('status', ALL_INBOX_STATUSES).is('deleted_at', null),
    supabase.from('bills').select('*', { count: 'exact', head: true }).in('status', REVIEW_STATUSES).is('deleted_at', null),
    supabase.from('bills').select('*', { count: 'exact', head: true }).in('status', PENDING_STATUSES).is('deleted_at', null),
    supabase.from('qb_accounts_cache').select('qb_account_id, name').in('account_type', ['Expense', 'Cost of Goods Sold']).eq('is_hidden', false).order('name'),
    supabase.from('qb_jobs_cache').select('qb_job_id, job_name, customer_name').eq('is_customer', false).order('customer_name'),
    supabase.from('companies').select('company_id, credit_balance, subscription_status, qb_connection_status').single(),
  ])

  const bills = billsResult.data ?? []
  const accounts = accountsResult.data ?? []
  const jobs = jobsResult.data ?? []
  const isInbox = activeTab !== 'archive'
  const companyId          = companyResult.data?.company_id            ?? ''
  const creditBalance      = companyResult.data?.credit_balance        ?? 0
  const subscriptionStatus = companyResult.data?.subscription_status  ?? 'trial'
  const qbConnected        = companyResult.data?.qb_connection_status === 'connected'

  const tabs = [
    { id: 'all',     label: 'All Inbox',          count: allInboxCountResult.count ?? 0 },
    { id: 'review',  label: 'Needs Review',       count: reviewCountResult.count ?? 0 },
    { id: 'pending', label: 'Pending Job Match',  count: pendingCountResult.count ?? 0 },
    { id: 'archive', label: 'Archive',            count: null },
  ]

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div
        className="flex-none flex items-center justify-between px-5 py-[14px]"
        style={{ background: 'white', borderBottom: '0.5px solid var(--color-border-tertiary)' }}
      >
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 500, color: 'var(--color-text-primary)' }}>Bills</h1>
          <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>
            Vendor invoices captured via email
          </p>
        </div>
        <UploadButton creditBalance={creditBalance} subscriptionStatus={subscriptionStatus} />
      </div>

      {/* Tab bar */}
      <div
        className="flex-none flex items-end px-5"
        style={{ background: 'white', borderBottom: '0.5px solid var(--color-border-tertiary)' }}
      >
        {tabs.map(t => {
          const href = t.id === 'all' ? '/bills' : `/bills?tab=${t.id}`
          return (
            <Link
              key={t.id}
              href={href}
              className="flex items-center gap-1.5"
              style={{
                padding: '10px 14px',
                fontSize: 12,
                fontWeight: activeTab === t.id ? 500 : 400,
                color: activeTab === t.id ? '#1A3D2B' : 'var(--color-text-secondary)',
                borderBottom: activeTab === t.id ? '2px solid #2DB87A' : '2px solid transparent',
                marginBottom: -1,
                textDecoration: 'none',
              }}
            >
              {t.label}
              {t.count != null && t.count > 0 && (
                <span
                  style={{
                    background: '#2DB87A', color: 'white',
                    fontSize: 9, fontWeight: 500,
                    padding: '1px 6px', borderRadius: 10,
                  }}
                >
                  {t.count}
                </span>
              )}
            </Link>
          )
        })}

        {/* Archive search */}
        {activeTab === 'archive' && (
          <form method="GET" className="ml-auto flex items-center gap-2 mb-1">
            <input type="hidden" name="tab" value="archive" />
            <div className="relative">
              <i className="ti ti-search absolute left-2.5 top-1/2 -translate-y-1/2" style={{ fontSize: 13, color: 'var(--color-text-tertiary)' }} />
              <input
                type="text"
                name="q"
                defaultValue={search}
                placeholder="Search vendor or invoice…"
                style={{
                  height: 28, paddingLeft: 28, paddingRight: 10,
                  border: '0.5px solid var(--color-border-secondary)',
                  borderRadius: 6, fontSize: 12,
                  color: 'var(--color-text-primary)',
                  width: 220,
                }}
              />
            </div>
            {search && (
              <Link href="/bills?tab=archive" style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>Clear</Link>
            )}
          </form>
        )}
      </div>

      {/* QuickBooks connect prompt (dismissed once connected) */}
      {!qbConnected && <QBConnectBanner />}

      {/* Credit warning banner */}
      <CreditBanner creditBalance={creditBalance} subscriptionStatus={subscriptionStatus} />

      {/* Realtime subscription — notifies UI the moment a bill is inserted or updated */}
      {isInbox && companyId && (
        <BillsRealtime
          companyId={companyId}
          draftBillIds={bills.filter(b => b.status === 'draft').map(b => b.bill_id)}
        />
      )}

      {/* Bill list */}
      <div className="flex-1 overflow-auto" style={{ background: 'white' }}>
        {bills.length === 0 ? (
          <EmptyState tab={activeTab} search={search} />
        ) : (
          <BillsList bills={bills as unknown as Parameters<typeof BillsList>[0]['bills']} accounts={accounts} jobs={jobs} isInbox={isInbox} />
        )}
      </div>
    </div>
  )
}

function QBConnectBanner() {
  return (
    <div
      className="flex-none flex items-center justify-between px-5 py-3 gap-4"
      style={{ background: '#EBF5EF', borderBottom: '0.5px solid #C3DEC9' }}
    >
      <div className="flex items-start gap-2">
        <i className="ti ti-plug" style={{ fontSize: 15, color: '#1A3D2B', flexShrink: 0, marginTop: 1 }} />
        <div>
          <p style={{ fontSize: 13, color: '#1A3D2B' }}>
            <span style={{ fontWeight: 500 }}>QuickBooks not connected.</span>
            {' '}Upload or forward invoices to see OCR in action — connect QuickBooks when you&apos;re ready to push bills.
          </p>
          <p style={{ fontSize: 11, color: '#3D6B4D', marginTop: 2 }}>
            Vendor defaults, GL accounts, and other setup live under Settings in the sidebar whenever you want to fine-tune things.
          </p>
        </div>
      </div>
      <Link
        href="/settings"
        style={{
          flexShrink: 0,
          background: '#1A3D2B', color: 'white',
          fontSize: 12, fontWeight: 600,
          padding: '6px 14px', borderRadius: 6,
          textDecoration: 'none',
          whiteSpace: 'nowrap',
        }}
      >
        Connect QuickBooks
      </Link>
    </div>
  )
}

function CreditBanner({ creditBalance, subscriptionStatus }: { creditBalance: number; subscriptionStatus: string }) {
  if (subscriptionStatus === 'trial') {
    if (creditBalance === 0) {
      return (
        <div
          className="flex-none flex items-center justify-between px-5 py-3 gap-4"
          style={{ background: '#FEF2F2', borderBottom: '0.5px solid #FECACA' }}
        >
          <div className="flex items-center gap-2">
            <i className="ti ti-alert-circle" style={{ fontSize: 15, color: '#DC2626', flexShrink: 0 }} />
            <p style={{ fontSize: 13, color: '#991B1B' }}>
              <span style={{ fontWeight: 500 }}>Your free trial credits are used up.</span>
              {' '}Subscribe to keep processing invoices — your existing bills are safe.
            </p>
          </div>
          <Link
            href="/billing"
            style={{
              flexShrink: 0,
              background: '#DC2626', color: 'white',
              fontSize: 12, fontWeight: 600,
              padding: '6px 14px', borderRadius: 6,
              textDecoration: 'none',
            }}
          >
            Choose a plan
          </Link>
        </div>
      )
    }

    if (creditBalance <= 5) {
      return (
        <div
          className="flex-none flex items-center justify-between px-5 py-3 gap-4"
          style={{ background: '#FFFBEB', borderBottom: '0.5px solid #FDE68A' }}
        >
          <div className="flex items-center gap-2">
            <i className="ti ti-alert-triangle" style={{ fontSize: 15, color: '#D97706', flexShrink: 0 }} />
            <p style={{ fontSize: 13, color: '#92400E' }}>
              <span style={{ fontWeight: 500 }}>
                {creditBalance === 1 ? '1 trial credit' : `${creditBalance} trial credits`} remaining.
              </span>
              {' '}Subscribe now to keep processing without interruption.
            </p>
          </div>
          <Link
            href="/billing"
            style={{
              flexShrink: 0,
              background: '#D97706', color: 'white',
              fontSize: 12, fontWeight: 600,
              padding: '6px 14px', borderRadius: 6,
              textDecoration: 'none',
            }}
          >
            Subscribe
          </Link>
        </div>
      )
    }
  }

  if (subscriptionStatus === 'past_due') {
    return (
      <div
        className="flex-none flex items-center justify-between px-5 py-3 gap-4"
        style={{ background: '#FEF2F2', borderBottom: '0.5px solid #FECACA' }}
      >
        <div className="flex items-center gap-2">
          <i className="ti ti-alert-circle" style={{ fontSize: 15, color: '#DC2626', flexShrink: 0 }} />
          <p style={{ fontSize: 13, color: '#991B1B' }}>
            <span style={{ fontWeight: 500 }}>Payment failed.</span>
            {' '}Update your payment method to keep your subscription active.
          </p>
        </div>
        <Link
          href="/billing"
          style={{
            flexShrink: 0,
            background: '#DC2626', color: 'white',
            fontSize: 12, fontWeight: 600,
            padding: '6px 14px', borderRadius: 6,
            textDecoration: 'none',
          }}
        >
          Fix payment
        </Link>
      </div>
    )
  }

  return null
}

function EmptyState({ tab, search }: { tab: string; search: string }) {
  if (tab === 'review') {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
        <i className="ti ti-circle-check" style={{ fontSize: 48, color: '#2DB87A' }} />
        <h2 style={{ fontSize: 16, fontWeight: 500, color: 'var(--color-text-primary)', marginTop: 16 }}>
          {"You're all caught up"}
        </h2>
        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 6, maxWidth: 380 }}>
          No invoices need your attention. Auto-publish is running in the background.
        </p>
      </div>
    )
  }
  if (tab === 'pending') {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
        <i className="ti ti-clock" style={{ fontSize: 48, color: 'var(--color-text-tertiary)' }} />
        <h2 style={{ fontSize: 16, fontWeight: 500, color: 'var(--color-text-primary)', marginTop: 16 }}>
          No bills pending job match
        </h2>
        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 6 }}>
          Bills where a job reference was found on the invoice but no matching QuickBooks job could be found. The system retries automatically every 2 hours.
        </p>
      </div>
    )
  }
  if (tab === 'all') {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
        <i className="ti ti-circle-check" style={{ fontSize: 48, color: '#2DB87A' }} />
        <h2 style={{ fontSize: 16, fontWeight: 500, color: 'var(--color-text-primary)', marginTop: 16 }}>
          Your inbox is empty
        </h2>
        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 6 }}>
          No bills are waiting for review or job matching.
        </p>
      </div>
    )
  }
  return (
    <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
      <i className="ti ti-file-invoice" style={{ fontSize: 48, color: 'var(--color-text-tertiary)' }} />
      <h2 style={{ fontSize: 16, fontWeight: 500, color: 'var(--color-text-primary)', marginTop: 16 }}>
        {search ? 'No matching bills' : 'No archived bills yet'}
      </h2>
      <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 6 }}>
        {search ? 'Try a different search term.' : 'Published bills appear here automatically.'}
      </p>
    </div>
  )
}
