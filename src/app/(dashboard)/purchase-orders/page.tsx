import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { PoUploadButton } from './po-upload-button'

const STATUS_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  open:               { bg: '#D1FAE5', color: '#065F46', label: 'Open' },
  partially_received: { bg: '#FEF3C7', color: '#92400E', label: 'Partially Received' },
  received:           { bg: '#DBEAFE', color: '#1E40AF', label: 'Received' },
  closed:             { bg: '#F3F4F6', color: '#374151', label: 'Closed' },
}

export default async function PurchaseOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab = 'open' } = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from('purchase_orders')
    .select(`
      po_id, vendor_name_raw, po_number, order_date, expected_delivery_date,
      job_id, status, qb_po_id, qb_sync_error, created_at,
      vendors(vendor_name_display)
    `)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (tab === 'open') {
    query = query.eq('status', 'open')
  } else if (tab === 'partial') {
    query = query.eq('status', 'partially_received')
  }
  // 'all' → no status filter

  const { data: pos } = await query

  // Counts for tab badges + jobs lookup
  const [{ count: openCount }, { count: partialCount }, { data: jobs }] = await Promise.all([
    supabase.from('purchase_orders').select('*', { count: 'exact', head: true }).eq('status', 'open').is('deleted_at', null),
    supabase.from('purchase_orders').select('*', { count: 'exact', head: true }).eq('status', 'partially_received').is('deleted_at', null),
    supabase.from('qb_jobs_cache').select('qb_job_id, job_number, job_name, customer_name'),
  ])

  const jobMap = new Map((jobs ?? []).map(j => [
    j.qb_job_id,
    [j.job_number, j.job_name, j.customer_name].filter(Boolean).join(' – '),
  ]))

  const tabs = [
    { id: 'open',    label: 'Open',              count: openCount ?? 0 },
    { id: 'partial', label: 'Partially Received', count: partialCount ?? 0 },
    { id: 'all',     label: 'All POs',            count: null },
  ]

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div
        className="flex-none flex items-center justify-between px-5 py-[14px]"
        style={{ background: 'white', borderBottom: '0.5px solid var(--color-border-tertiary)' }}
      >
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 500, color: 'var(--color-text-primary)' }}>
            Purchase Orders
          </h1>
          <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>
            PO confirmations captured via email, pushed to QuickBooks
          </p>
        </div>
        <PoUploadButton />
      </div>

      {/* Tab bar */}
      <div
        className="flex-none flex items-end px-5"
        style={{ background: 'white', borderBottom: '0.5px solid var(--color-border-tertiary)' }}
      >
        {tabs.map(t => (
          <Link
            key={t.id}
            href={`/purchase-orders?tab=${t.id}`}
            className="flex items-center gap-1.5"
            style={{
              padding: '10px 14px',
              fontSize: 12,
              fontWeight: tab === t.id ? 500 : 400,
              color: tab === t.id ? '#1A3D2B' : 'var(--color-text-secondary)',
              borderBottom: tab === t.id ? '2px solid #2DB87A' : '2px solid transparent',
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
        ))}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto" style={{ background: 'white' }}>
        {!pos || pos.length === 0 ? (
          <EmptyState tab={tab} />
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
              {['Vendor', 'PO #', 'Date', 'Job', 'Status'].map(h => (
                <span
                  key={h}
                  style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-secondary)' }}
                >
                  {h}
                </span>
              ))}
            </div>

            {pos.map((po, i) => {
              const badge = STATUS_BADGE[po.status] ?? STATUS_BADGE.open
              const vendorDisplay = (po.vendors as unknown as { vendor_name_display: string | null } | null)?.vendor_name_display ?? po.vendor_name_raw ?? '—'
              return (
                <Link
                  key={po.po_id}
                  href={`/purchase-orders/${po.po_id}`}
                  className="grid items-center px-5 py-[10px]"
                  style={{
                    gridTemplateColumns: '1.8fr 0.9fr 0.7fr 0.9fr 80px',
                    borderBottom: '0.5px solid var(--color-border-tertiary)',
                    background: i % 2 === 0 ? 'white' : 'var(--color-background-secondary)',
                    textDecoration: 'none',
                    display: 'grid',
                  }}
                >
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>
                      {vendorDisplay}
                    </p>
                    {po.qb_sync_error && (
                      <p style={{ fontSize: 11, color: '#DC2626' }}>{po.qb_sync_error}</p>
                    )}
                  </div>
                  <span style={{ fontSize: 13, color: 'var(--color-text-primary)' }}>
                    {po.po_number ?? '—'}
                  </span>
                  <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                    {po.order_date ? new Date(po.order_date).toLocaleDateString() : '—'}
                  </span>
                  <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                    {po.job_id ? (jobMap.get(po.job_id) ?? po.job_id) : '—'}
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

function EmptyState({ tab }: { tab: string }) {
  if (tab === 'open') {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
        <i className="ti ti-circle-check" style={{ fontSize: 48, color: '#2DB87A' }} />
        <h2 style={{ fontSize: 16, fontWeight: 500, color: 'var(--color-text-primary)', marginTop: 16 }}>
          No open purchase orders
        </h2>
        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 6, maxWidth: 380 }}>
          When vendors email PO confirmations to your PO capture address, they will appear here automatically.
        </p>
      </div>
    )
  }
  return (
    <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
      <i className="ti ti-clipboard-list" style={{ fontSize: 48, color: 'var(--color-text-tertiary)' }} />
      <h2 style={{ fontSize: 16, fontWeight: 500, color: 'var(--color-text-primary)', marginTop: 16 }}>
        No purchase orders
      </h2>
      <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 6 }}>
        Purchase orders will appear here as they are captured.
      </p>
    </div>
  )
}
