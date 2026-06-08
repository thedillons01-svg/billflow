import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { ReceivingList } from './receiving-list'

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
    [j.customer_name, j.job_number, j.job_name].filter(Boolean).join(' – '),
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
        <ReceivingList
          jobMap={jobMap}
          pos={(openPOs ?? []).map(po => {
            const vendor = (po.vendors as unknown as { vendor_name_display: string | null } | null)
            return {
              po_id:               po.po_id,
              vendor_name_raw:     po.vendor_name_raw,
              vendor_name_display: vendor?.vendor_name_display ?? null,
              po_number:           po.po_number,
              order_date:          po.order_date,
              job_id:              po.job_id,
              status:              po.status,
              created_by:          po.created_by,
              ordered_by:          po.created_by
                ? (po.created_by === user?.id ? 'Ordered by you' : `Ordered by ${userNameMap.get(po.created_by) ?? 'team member'}`)
                : '',
              lines: (po.po_line_items as {
                line_id: string; description: string | null
                quantity_ordered: number | null; quantity_received: number | null; unit_cost: number | null
              }[]) ?? [],
            }
          })}
        />
      </div>
    </div>
  )
}
