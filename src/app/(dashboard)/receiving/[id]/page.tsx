import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ReceivingForm } from './receiving-form'

export default async function ReceivingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: po } = await supabase
    .from('purchase_orders')
    .select(`
      po_id, company_id, vendor_name_raw, po_number, order_date, job_id, status, created_by,
      vendors(vendor_name_display),
      po_line_items(line_id, description, quantity_ordered, quantity_received, unit_cost, extended_cost, sort_order)
    `)
    .eq('po_id', id)
    .single()

  if (!po || (po.status !== 'open' && po.status !== 'partially_received')) {
    notFound()
  }

  let jobLabel: string | null = null
  if (po.job_id) {
    const { data: job } = await supabase
      .from('qb_jobs_cache')
      .select('job_number, job_name, customer_name')
      .eq('company_id', po.company_id)
      .eq('qb_job_id', po.job_id)
      .single()
    jobLabel = job
      ? [job.job_number, job.job_name, job.customer_name].filter(Boolean).join(' – ')
      : po.job_id
  }

  const vendor = (po.vendors as unknown as { vendor_name_display: string | null } | null)
  const vendorName = vendor?.vendor_name_display ?? po.vendor_name_raw ?? 'Unknown Vendor'
  const lines = (po.po_line_items as {
    line_id: string
    description: string | null
    quantity_ordered: number | null
    quantity_received: number | null
    unit_cost: number | null
    extended_cost: number | null
    sort_order: number
  }[]).sort((a, b) => a.sort_order - b.sort_order)

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div
        className="flex-none px-5 py-[14px]"
        style={{ background: 'white', borderBottom: '0.5px solid var(--color-border-tertiary)' }}
      >
        <Link
          href="/receiving"
          className="flex items-center gap-1 mb-2"
          style={{ fontSize: 12, color: 'var(--color-text-secondary)', textDecoration: 'none' }}
        >
          <i className="ti ti-arrow-left" style={{ fontSize: 12 }} />
          Back to Receiving
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 style={{ fontSize: 16, fontWeight: 500, color: 'var(--color-text-primary)' }}>
              {vendorName}
              {po.po_number && <span style={{ fontWeight: 400, color: 'var(--color-text-secondary)' }}> — PO #{po.po_number}</span>}
            </h1>
            <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>
              {po.order_date ? `Ordered ${new Date(po.order_date).toLocaleDateString()}` : ''}
              {jobLabel ? ` · ${jobLabel}` : ''}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-5 py-5 max-w-2xl">
        <ReceivingForm poId={po.po_id} lines={lines} />
      </div>
    </div>
  )
}
