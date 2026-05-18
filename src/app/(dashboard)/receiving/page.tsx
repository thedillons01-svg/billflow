import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import Link from 'next/link'

export default async function ReceivingPage() {
  const supabase = await createClient()
  const serviceClient = createServiceClient()

  const [{ data: openPOs }, { data: jobs }, { data: { user } }] = await Promise.all([
    supabase
      .from('purchase_orders')
      .select(`
        po_id, vendor_name_raw, po_number, order_date, job_id, status, created_at, created_by,
        vendors(vendor_name_display),
        po_line_items(line_id, description, quantity_ordered, quantity_received, unit_cost)
      `)
      .in('status', ['open', 'partially_received'])
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),
    supabase.from('qb_jobs_cache').select('qb_job_id, job_number, job_name, customer_name'),
    supabase.auth.getUser(),
  ])

  // Build a map of user_id → display name using auth.admin
  const creatorIds = [...new Set((openPOs ?? []).map(p => p.created_by).filter(Boolean) as string[])]
  const userNameMap = new Map<string, string>()
  if (creatorIds.length > 0) {
    await Promise.all(
      creatorIds.map(async (uid) => {
        try {
          const { data } = await serviceClient.auth.admin.getUserById(uid)
          if (data?.user) {
            const email = data.user.email ?? ''
            const meta = data.user.user_metadata as Record<string, string> | undefined
            const name = meta?.full_name ?? meta?.name ?? email.split('@')[0] ?? uid.slice(0, 8)
            userNameMap.set(uid, name)
          }
        } catch { /* silent */ }
      })
    )
  }

  const jobMap = new Map((jobs ?? []).map(j => [
    j.qb_job_id,
    [j.job_number, j.job_name, j.customer_name].filter(Boolean).join(' – '),
  ]))

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div
        className="flex-none flex items-center justify-between px-5 py-[14px]"
        style={{ background: 'white', borderBottom: '0.5px solid var(--color-border-tertiary)' }}
      >
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 500, color: 'var(--color-text-primary)' }}>
            Receiving
          </h1>
          <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>
            Mark materials as received against open purchase orders
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-5 py-5">
        {!openPOs || openPOs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <i className="ti ti-package" style={{ fontSize: 48, color: 'var(--color-text-tertiary)' }} />
            <h2 style={{ fontSize: 16, fontWeight: 500, color: 'var(--color-text-primary)', marginTop: 16 }}>
              No open purchase orders
            </h2>
            <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 6, maxWidth: 380 }}>
              When materials arrive, open purchase orders will appear here so you can mark what was received.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {openPOs.map(po => {
              const vendor = (po.vendors as unknown as { vendor_name_display: string | null } | null)
              const vendorName = vendor?.vendor_name_display ?? po.vendor_name_raw ?? 'Unknown vendor'
              const lines = (po.po_line_items as {
                line_id: string
                description: string | null
                quantity_ordered: number | null
                quantity_received: number | null
                unit_cost: number | null
              }[]) ?? []

              return (
                <div
                  key={po.po_id}
                  style={{
                    background: 'white',
                    border: '0.5px solid var(--color-border-tertiary)',
                    borderRadius: 8,
                    overflow: 'hidden',
                  }}
                >
                  {/* PO header */}
                  <div
                    className="flex items-center justify-between px-5 py-3"
                    style={{ borderBottom: '0.5px solid var(--color-border-tertiary)' }}
                  >
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)' }}>
                        {vendorName}
                        {po.po_number && (
                          <span style={{ fontWeight: 400, color: 'var(--color-text-secondary)', marginLeft: 8 }}>
                            PO #{po.po_number}
                          </span>
                        )}
                      </p>
                      <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>
                        {po.order_date ? `Ordered ${new Date(po.order_date).toLocaleDateString()}` : ''}
                        {po.job_id ? ` · ${jobMap.get(po.job_id) ?? po.job_id}` : ''}
                        {po.created_by ? ` · Ordered by ${po.created_by === user?.id ? 'you' : (userNameMap.get(po.created_by) ?? 'team member')}` : ''}
                      </p>
                    </div>
                    <span
                      style={{
                        background: po.status === 'partially_received' ? '#FEF3C7' : '#D1FAE5',
                        color: po.status === 'partially_received' ? '#92400E' : '#065F46',
                        borderRadius: 4, padding: '3px 8px',
                        fontSize: 10, fontWeight: 500,
                      }}
                    >
                      {po.status === 'partially_received' ? 'Partially Received' : 'Open'}
                    </span>
                  </div>

                  {/* Line items */}
                  {lines.length > 0 ? (
                    <div>
                      {/* Column headers */}
                      <div
                        className="grid px-5 py-2"
                        style={{
                          gridTemplateColumns: '2fr 0.8fr 0.8fr 0.8fr 100px',
                          borderBottom: '0.5px solid var(--color-border-tertiary)',
                          background: 'var(--color-background-secondary)',
                        }}
                      >
                        {['Description', 'Ordered', 'Received', 'Unit Cost', ''].map(h => (
                          <span key={h} style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-secondary)' }}>
                            {h}
                          </span>
                        ))}
                      </div>
                      {lines.map((line, idx) => {
                        const allReceived = (line.quantity_received ?? 0) >= (line.quantity_ordered ?? 0)
                        return (
                          <div
                            key={line.line_id}
                            className="grid items-center px-5 py-2"
                            style={{
                              gridTemplateColumns: '2fr 0.8fr 0.8fr 0.8fr 100px',
                              borderBottom: idx < lines.length - 1 ? '0.5px solid var(--color-border-tertiary)' : 'none',
                            }}
                          >
                            <span style={{ fontSize: 13, color: 'var(--color-text-primary)' }}>
                              {line.description ?? '—'}
                            </span>
                            <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                              {line.quantity_ordered ?? '—'}
                            </span>
                            <span style={{ fontSize: 13, color: allReceived ? '#065F46' : 'var(--color-text-secondary)' }}>
                              {line.quantity_received ?? 0}
                            </span>
                            <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                              {line.unit_cost != null ? `$${Number(line.unit_cost).toFixed(2)}` : '—'}
                            </span>
                            <span style={{ fontSize: 11, color: allReceived ? '#065F46' : '#D97706' }}>
                              {allReceived ? 'Received' : 'Pending'}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="px-5 py-3" style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                      No line items on this PO.
                    </p>
                  )}

                  {/* Receive button */}
                  <div
                    className="flex justify-end px-5 py-3"
                    style={{ borderTop: '0.5px solid var(--color-border-tertiary)' }}
                  >
                    <Link
                      href={`/receiving/${po.po_id}`}
                      className="inline-flex items-center gap-1.5"
                      style={{
                        background: '#2DB87A', color: 'white',
                        borderRadius: 6, padding: '7px 16px',
                        fontSize: 13, fontWeight: 500,
                        textDecoration: 'none',
                      }}
                    >
                      <i className="ti ti-package" style={{ fontSize: 14 }} />
                      Record Receiving
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
