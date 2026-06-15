import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { PoUploadButton } from './po-upload-button'
import { PoList } from './po-list'
import { RecalculateJobsButton } from './recalculate-jobs-button'


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

  // Counts for tab badges + jobs lookup + credit status
  const [{ count: openCount }, { count: partialCount }, { data: jobs }, { data: company }] = await Promise.all([
    supabase.from('purchase_orders').select('*', { count: 'exact', head: true }).eq('status', 'open').is('deleted_at', null),
    supabase.from('purchase_orders').select('*', { count: 'exact', head: true }).eq('status', 'partially_received').is('deleted_at', null),
    supabase.from('qb_jobs_cache').select('qb_job_id, job_number, job_name, customer_name'),
    supabase.from('companies').select('credit_balance, subscription_status').single(),
  ])
  const creditBalance = company?.credit_balance ?? 1
  const subscriptionStatus = company?.subscription_status ?? 'trial'

  const jobMap = new Map((jobs ?? []).map(j => [
    j.qb_job_id,
    [j.customer_name, j.job_number, j.job_name].filter(Boolean).join(' – '),
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
        <div className="flex items-center gap-4">
          <RecalculateJobsButton />
          <PoUploadButton creditBalance={creditBalance} subscriptionStatus={subscriptionStatus} />
        </div>
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
          <PoList pos={pos as unknown as Parameters<typeof PoList>[0]['pos']} jobMap={jobMap} />
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
