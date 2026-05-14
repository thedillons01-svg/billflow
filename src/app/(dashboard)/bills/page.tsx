import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

const REVIEW_STATUSES = ['draft', 'ready', 'sync_error']
const PENDING_STATUSES = ['pending_job_match']
const ARCHIVE_STATUSES = ['published']

const STATUS_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  draft:             { bg: '#FEF3C7', color: '#92400E', label: 'Needs Review' },
  ready:             { bg: '#D1FAE5', color: '#065F46', label: 'Ready' },
  sync_error:        { bg: '#FEE2E2', color: '#991B1B', label: 'Sync Error' },
  pending_job_match: { bg: '#EDE9FE', color: '#5B21B6', label: 'Pending Job Match' },
  publishing:        { bg: '#DBEAFE', color: '#1E40AF', label: 'Publishing' },
  published:         { bg: '#D1FAE5', color: '#065F46', label: 'Published' },
}

export default async function BillsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string }>
}) {
  const { tab, q } = await searchParams
  const activeTab = tab === 'pending' ? 'pending' : tab === 'archive' ? 'archive' : 'review'
  const search = q?.trim() ?? ''

  const supabase = await createClient()

  let statuses: string[]
  if (activeTab === 'review') statuses = REVIEW_STATUSES
  else if (activeTab === 'pending') statuses = PENDING_STATUSES
  else statuses = ARCHIVE_STATUSES

  let query = supabase
    .from('bills')
    .select('bill_id, vendor_name_raw, invoice_number, invoice_date, total, status, autopublish_hold_reason')
    .in('status', statuses)
    .is('deleted_at', null)
    .order('created_at', { ascending: activeTab === 'archive' })

  if (search && activeTab === 'archive') {
    query = query.or(`vendor_name_raw.ilike.%${search}%,invoice_number.ilike.%${search}%`)
  }

  const { data } = await query.limit(activeTab === 'archive' ? 200 : 500)
  const bills = data ?? []

  // Tab counts
  const [{ count: reviewCount }, { count: pendingCount }] = await Promise.all([
    supabase.from('bills').select('*', { count: 'exact', head: true }).in('status', REVIEW_STATUSES).is('deleted_at', null),
    supabase.from('bills').select('*', { count: 'exact', head: true }).in('status', PENDING_STATUSES).is('deleted_at', null),
  ])

  const tabs = [
    { id: 'review',  label: 'Needs Review',      count: reviewCount ?? 0 },
    { id: 'pending', label: 'Pending Job Match',  count: pendingCount ?? 0 },
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
      </div>

      {/* Tab bar */}
      <div
        className="flex-none flex items-end px-5"
        style={{ background: 'white', borderBottom: '0.5px solid var(--color-border-tertiary)' }}
      >
        {tabs.map(t => {
          const href = t.id === 'review' ? '/bills' : `/bills?tab=${t.id}`
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

      {/* Bill list */}
      <div className="flex-1 overflow-auto" style={{ background: 'white' }}>
        {bills.length === 0 ? (
          <EmptyState tab={activeTab} search={search} />
        ) : (
          <>
            {/* Column headers */}
            <div
              className="grid px-5 py-2"
              style={{
                gridTemplateColumns: '1.8fr 0.9fr 0.7fr 0.9fr 80px',
                borderBottom: '0.5px solid var(--color-border-tertiary)',
              }}
            >
              {['Vendor', 'Invoice #', 'Date', 'Total', 'Status'].map(h => (
                <span
                  key={h}
                  style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-secondary)' }}
                >
                  {h}
                </span>
              ))}
            </div>

            {bills.map((bill, i) => {
              const badge = STATUS_BADGE[bill.status] ?? STATUS_BADGE.draft
              return (
                <Link
                  key={bill.bill_id}
                  href={`/bills/${bill.bill_id}`}
                  className="grid items-center px-5 py-[10px]"
                  style={{
                    gridTemplateColumns: '1.8fr 0.9fr 0.7fr 0.9fr 80px',
                    borderBottom: '0.5px solid var(--color-border-tertiary)',
                    background: i % 2 === 0 ? 'white' : 'var(--color-background-secondary)',
                    cursor: 'pointer',
                    textDecoration: 'none',
                    display: 'grid',
                  }}
                >
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>
                      {bill.vendor_name_raw ?? 'Unknown Vendor'}
                    </p>
                    {bill.autopublish_hold_reason && (
                      <p style={{ fontSize: 11, color: '#D97706' }}>
                        {bill.autopublish_hold_reason}
                      </p>
                    )}
                  </div>
                  <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                    {bill.invoice_number ?? '—'}
                  </span>
                  <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                    {bill.invoice_date ? new Date(bill.invoice_date).toLocaleDateString() : '—'}
                  </span>
                  <span style={{ fontSize: 13, color: 'var(--color-text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                    {bill.total != null ? `$${Number(bill.total).toFixed(2)}` : '—'}
                  </span>
                  <span
                    style={{
                      display: 'inline-block',
                      background: badge.bg, color: badge.color,
                      borderRadius: 4, padding: '3px 8px',
                      fontSize: 10, fontWeight: 500,
                    }}
                  >
                    {badge.label}
                  </span>
                </Link>
              )
            })}
          </>
        )}
      </div>
    </div>
  )
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
          Bills waiting for a QuickBooks job to appear will show here.
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
