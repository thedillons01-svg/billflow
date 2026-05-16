import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createClient()

  const [
    { count: needsReviewCount },
    { count: pendingJobCount },
    { count: openPOCount },
    { count: partialPOCount },
    { count: syncErrorCount },
    { data: company },
  ] = await Promise.all([
    supabase
      .from('bills')
      .select('*', { count: 'exact', head: true })
      .in('status', ['draft', 'ready'])
      .is('deleted_at', null),
    supabase
      .from('bills')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending_job_match')
      .is('deleted_at', null),
    supabase
      .from('purchase_orders')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'open')
      .is('deleted_at', null),
    supabase
      .from('purchase_orders')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'partially_received')
      .is('deleted_at', null),
    supabase
      .from('bills')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'sync_error')
      .is('deleted_at', null),
    supabase
      .from('companies')
      .select('name, qb_connection_status, qb_last_sync, credit_balance, plan_name, capture_email_prefix, company_id')
      .single(),
  ])

  const isQBConnected = company?.qb_connection_status === 'connected'
  const prefix = company?.capture_email_prefix ?? company?.company_id?.slice(0, 8) ?? 'your-company'
  const billsAddress = `${prefix}-bills@purchasomatic.com`
  const posAddress = `${prefix}-pos@purchasomatic.com`
  const creditBalance = company?.credit_balance ?? 0
  const inboxTotal = (needsReviewCount ?? 0) + (pendingJobCount ?? 0)

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div
        className="flex-none flex items-center justify-between px-5 py-[14px]"
        style={{ background: 'white', borderBottom: '0.5px solid var(--color-border-tertiary)' }}
      >
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 500, color: 'var(--color-text-primary)' }}>
            {company?.name ?? 'Dashboard'}
          </h1>
          <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>
            Overview of your Purchasomatic account
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
            {creditBalance.toLocaleString()} credits
          </span>
          <Link
            href="/billing"
            style={{
              fontSize: 12, fontWeight: 500,
              color: '#2DB87A',
              textDecoration: 'none',
            }}
          >
            Buy more
          </Link>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-5 py-5">
        <div style={{ maxWidth: 860 }} className="space-y-5">

          {/* Status alerts */}
          {syncErrorCount && syncErrorCount > 0 ? (
            <div
              className="flex items-center gap-3 px-4 py-3"
              style={{
                background: '#FEF2F2', border: '0.5px solid #FCA5A5',
                borderRadius: 8, borderLeft: '3px solid #EF4444',
              }}
            >
              <i className="ti ti-alert-circle" style={{ fontSize: 16, color: '#DC2626' }} />
              <div className="flex-1">
                <p style={{ fontSize: 13, fontWeight: 500, color: '#991B1B' }}>
                  {syncErrorCount} bill{syncErrorCount !== 1 ? 's' : ''} failed to sync to QuickBooks
                </p>
                <p style={{ fontSize: 11, color: '#B91C1C' }}>Review and retry from the Bills inbox.</p>
              </div>
              <Link
                href="/bills?tab=review"
                style={{
                  fontSize: 12, fontWeight: 500, color: '#DC2626',
                  textDecoration: 'none',
                  border: '0.5px solid #FCA5A5',
                  borderRadius: 6, padding: '4px 12px',
                  background: 'white',
                }}
              >
                View errors
              </Link>
            </div>
          ) : null}

          {!isQBConnected && (
            <div
              className="flex items-center gap-3 px-4 py-3"
              style={{
                background: '#FFFBEB', border: '0.5px solid #FCD34D',
                borderRadius: 8, borderLeft: '3px solid #F59E0B',
              }}
            >
              <i className="ti ti-plug" style={{ fontSize: 16, color: '#D97706' }} />
              <div className="flex-1">
                <p style={{ fontSize: 13, fontWeight: 500, color: '#92400E' }}>
                  QuickBooks not connected
                </p>
                <p style={{ fontSize: 11, color: '#B45309' }}>Connect QuickBooks to push bills and sync your vendor list.</p>
              </div>
              <Link
                href="/settings"
                style={{
                  fontSize: 12, fontWeight: 500, color: '#D97706',
                  textDecoration: 'none',
                  border: '0.5px solid #FCD34D',
                  borderRadius: 6, padding: '4px 12px',
                  background: 'white',
                }}
              >
                Connect
              </Link>
            </div>
          )}

          {/* Document type cards */}
          <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr' }}>

            {/* Bills card */}
            <Link
              href="/bills"
              style={{ textDecoration: 'none' }}
            >
              <div
                style={{
                  background: 'white',
                  border: '0.5px solid var(--color-border-tertiary)',
                  borderRadius: 8,
                  overflow: 'hidden',
                  cursor: 'pointer',
                }}
              >
                <div
                  className="flex items-center justify-between px-5 py-4"
                  style={{ borderBottom: '0.5px solid var(--color-border-tertiary)' }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      style={{
                        width: 36, height: 36, borderRadius: 8,
                        background: '#EBF5EF',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <i className="ti ti-file-invoice" style={{ fontSize: 18, color: '#1A3D2B' }} />
                    </div>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)' }}>Bills</p>
                      <p style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>Vendor invoices</p>
                    </div>
                  </div>
                  <i className="ti ti-arrow-right" style={{ fontSize: 14, color: 'var(--color-text-tertiary)' }} />
                </div>

                <div className="grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                  <StatCell
                    value={needsReviewCount ?? 0}
                    label="Needs Review"
                    highlight={!!needsReviewCount && needsReviewCount > 0}
                  />
                  <StatCell
                    value={pendingJobCount ?? 0}
                    label="Pending Job"
                    divider
                  />
                  <StatCell
                    value={syncErrorCount ?? 0}
                    label="Sync Error"
                    divider
                    error={!!syncErrorCount && syncErrorCount > 0}
                  />
                </div>

                <div
                  className="px-5 py-3"
                  style={{ borderTop: '0.5px solid var(--color-border-tertiary)', background: '#F9FAFB' }}
                >
                  <p style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>
                    Capture: <span style={{ color: 'var(--color-text-secondary)', fontFamily: 'monospace' }}>{billsAddress}</span>
                  </p>
                </div>
              </div>
            </Link>

            {/* Purchase Orders card */}
            <Link
              href="/purchase-orders"
              style={{ textDecoration: 'none' }}
            >
              <div
                style={{
                  background: 'white',
                  border: '0.5px solid var(--color-border-tertiary)',
                  borderRadius: 8,
                  overflow: 'hidden',
                  cursor: 'pointer',
                }}
              >
                <div
                  className="flex items-center justify-between px-5 py-4"
                  style={{ borderBottom: '0.5px solid var(--color-border-tertiary)' }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      style={{
                        width: 36, height: 36, borderRadius: 8,
                        background: '#EEF2FF',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <i className="ti ti-shopping-cart" style={{ fontSize: 18, color: '#4338CA' }} />
                    </div>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)' }}>Purchase Orders</p>
                      <p style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>Materials ordered for jobs</p>
                    </div>
                  </div>
                  <i className="ti ti-arrow-right" style={{ fontSize: 14, color: 'var(--color-text-tertiary)' }} />
                </div>

                <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  <StatCell
                    value={openPOCount ?? 0}
                    label="Open POs"
                    highlight={!!openPOCount && openPOCount > 0}
                  />
                  <StatCell
                    value={partialPOCount ?? 0}
                    label="Awaiting Receiving"
                    divider
                    highlight={!!partialPOCount && partialPOCount > 0}
                  />
                </div>

                <div
                  className="px-5 py-3"
                  style={{ borderTop: '0.5px solid var(--color-border-tertiary)', background: '#F9FAFB' }}
                >
                  <p style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>
                    Capture: <span style={{ color: 'var(--color-text-secondary)', fontFamily: 'monospace' }}>{posAddress}</span>
                  </p>
                </div>
              </div>
            </Link>
          </div>

          {/* QB status + credits row */}
          <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr' }}>

            {/* QuickBooks status */}
            <div
              style={{
                background: 'white',
                border: '0.5px solid var(--color-border-tertiary)',
                borderRadius: 8,
                padding: '16px 20px',
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>
                  QuickBooks
                </p>
                <span
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    background: isQBConnected ? '#D1FAE5' : '#FEF3C7',
                    color: isQBConnected ? '#065F46' : '#92400E',
                    borderRadius: 4, padding: '3px 8px',
                    fontSize: 10, fontWeight: 500,
                  }}
                >
                  <span
                    style={{
                      display: 'block', width: 6, height: 6, borderRadius: '50%',
                      background: isQBConnected ? '#10B981' : '#F59E0B',
                    }}
                  />
                  {isQBConnected ? 'Connected' : 'Not connected'}
                </span>
              </div>
              {isQBConnected && company?.qb_last_sync && (
                <p style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
                  Last synced: {new Date(company.qb_last_sync).toLocaleString()}
                </p>
              )}
              {!isQBConnected && (
                <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 10 }}>
                  Connect QuickBooks to push bills automatically.
                </p>
              )}
              <Link
                href="/settings"
                style={{
                  display: 'inline-block', marginTop: 10,
                  fontSize: 12, fontWeight: 500,
                  color: isQBConnected ? 'var(--color-text-secondary)' : '#2DB87A',
                  textDecoration: 'none',
                }}
              >
                {isQBConnected ? 'Manage connection →' : 'Connect QuickBooks →'}
              </Link>
            </div>

            {/* Credits */}
            <div
              style={{
                background: 'white',
                border: '0.5px solid var(--color-border-tertiary)',
                borderRadius: 8,
                padding: '16px 20px',
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>
                  Credits
                </p>
                <span
                  style={{
                    background: creditBalance < 10 ? '#FEE2E2' : '#EBF5EF',
                    color: creditBalance < 10 ? '#991B1B' : '#1A3D2B',
                    borderRadius: 4, padding: '3px 8px',
                    fontSize: 10, fontWeight: 500,
                  }}
                >
                  {company?.plan_name ?? 'Pay-as-you-go'}
                </span>
              </div>
              <p style={{ fontSize: 28, fontWeight: 600, color: 'var(--color-text-primary)', lineHeight: 1 }}>
                {creditBalance.toLocaleString()}
              </p>
              <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 4 }}>
                credits remaining · 1 per bill or PO
              </p>
              {creditBalance < 20 && (
                <p style={{ fontSize: 11, color: '#DC2626', marginTop: 6 }}>
                  Running low — purchase more to avoid processing delays.
                </p>
              )}
              <Link
                href="/billing"
                style={{
                  display: 'inline-block', marginTop: 10,
                  fontSize: 12, fontWeight: 500,
                  color: '#2DB87A',
                  textDecoration: 'none',
                }}
              >
                Buy credits →
              </Link>
            </div>
          </div>

          {/* Quick actions */}
          <div
            style={{
              background: 'white',
              border: '0.5px solid var(--color-border-tertiary)',
              borderRadius: 8,
              overflow: 'hidden',
            }}
          >
            <div
              className="px-5 py-3"
              style={{ borderBottom: '0.5px solid var(--color-border-tertiary)' }}
            >
              <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Quick Actions
              </p>
            </div>
            <div className="grid" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr' }}>
              {[
                { href: '/bills', icon: 'ti-file-invoice', label: 'Review Bills', sub: `${inboxTotal} waiting` },
                { href: '/receiving', icon: 'ti-package', label: 'Record Receiving', sub: `${openPOCount ?? 0} open POs` },
                { href: '/vendors', icon: 'ti-building-store', label: 'Manage Vendors', sub: 'Rules & settings' },
                { href: '/settings', icon: 'ti-settings', label: 'Settings', sub: 'Integrations & config' },
              ].map((item, i) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex flex-col items-center justify-center py-5 gap-2"
                  style={{
                    textDecoration: 'none',
                    borderRight: i < 3 ? '0.5px solid var(--color-border-tertiary)' : 'none',
                  }}
                >
                  <div
                    style={{
                      width: 40, height: 40, borderRadius: 8,
                      background: '#EBF5EF',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <i className={`ti ${item.icon}`} style={{ fontSize: 20, color: '#1A3D2B' }} />
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-primary)' }}>{item.label}</p>
                    <p style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{item.sub}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

function StatCell({
  value, label, divider, highlight, error,
}: {
  value: number
  label: string
  divider?: boolean
  highlight?: boolean
  error?: boolean
}) {
  return (
    <div
      className="flex flex-col items-center justify-center py-4"
      style={{
        borderLeft: divider ? '0.5px solid var(--color-border-tertiary)' : 'none',
      }}
    >
      <p
        style={{
          fontSize: 22, fontWeight: 600, lineHeight: 1,
          color: error ? '#DC2626' : highlight ? '#1A3D2B' : 'var(--color-text-primary)',
        }}
      >
        {value}
      </p>
      <p style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginTop: 3 }}>{label}</p>
    </div>
  )
}
