import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { PODetail } from './po-detail'
import { POPdfPanel } from './po-pdf-panel'

export default async function PODetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: po } = await supabase
    .from('purchase_orders')
    .select(`
      po_id, company_id, vendor_name_raw, po_number, order_date, expected_delivery_date,
      job_id, status, qb_po_id, qb_sync_error, pdf_url, notes, created_at, deleted_at,
      vendors(vendor_name_display),
      po_line_items(line_id, description, quantity_ordered, quantity_received, unit_cost, extended_cost, sort_order)
    `)
    .eq('po_id', id)
    .single()

  if (!po || po.deleted_at) notFound()

  // Matched bills + company settings (in parallel)
  const [{ data: matchedBills }, { data: companySettings }] = await Promise.all([
    supabase
      .from('bills')
      .select('bill_id, invoice_number, total, status, vendor_name_raw')
      .eq('matched_po_id', id)
      .is('deleted_at', null),
    supabase
      .from('companies')
      .select('push_pos_to_qb')
      .eq('company_id', po.company_id)
      .single(),
  ])

  // Job label from QB cache
  let jobLabel: string | null = null
  if (po.job_id) {
    const { data: job } = await supabase
      .from('qb_jobs_cache')
      .select('job_number, job_name, customer_name')
      .eq('company_id', po.company_id)
      .eq('qb_job_id', po.job_id)
      .single()
    if (job) {
      jobLabel = [job.job_number, job.job_name, job.customer_name].filter(Boolean).join(' · ')
    } else {
      jobLabel = po.job_id
    }
  }

  let pdfSignedUrl: string | null = null
  if (po.pdf_url) {
    const { data: signed } = await supabase.storage
      .from('bill-pdfs')
      .createSignedUrl(po.pdf_url, 3600)
    pdfSignedUrl = signed?.signedUrl ?? null
  }

  const vendor = (po.vendors as unknown as { vendor_name_display: string | null } | null)
  const vendorName = vendor?.vendor_name_display ?? po.vendor_name_raw ?? 'Unknown Vendor'

  const lineItems = ((po.po_line_items ?? []) as {
    line_id: string
    description: string | null
    quantity_ordered: number | null
    quantity_received: number | null
    unit_cost: number | null
    extended_cost: number | null
    sort_order: number
  }[]).sort((a, b) => a.sort_order - b.sort_order)

  return (
    <div className="flex" style={{ height: '100%' }}>
      {/* Left panel */}
      <div
        style={{
          width: 520, flexShrink: 0,
          display: 'flex', flexDirection: 'column',
          borderRight: '0.5px solid var(--color-border-tertiary)',
          background: 'white',
        }}
      >
        <PODetail
          po={{
            po_id: po.po_id,
            company_id: po.company_id,
            vendor_name: vendorName,
            po_number: po.po_number,
            order_date: po.order_date,
            expected_delivery_date: po.expected_delivery_date,
            job_id: po.job_id,
            status: po.status,
            qb_po_id: po.qb_po_id,
            qb_sync_error: po.qb_sync_error,
            notes: po.notes,
          }}
          lineItems={lineItems}
          matchedBills={(matchedBills ?? []) as {
            bill_id: string
            invoice_number: string | null
            total: number | null
            status: string
            vendor_name_raw: string | null
          }[]}
          jobLabel={jobLabel}
          pushPosToQb={companySettings?.push_pos_to_qb ?? true}
        />
      </div>

      {/* Right panel: PDF */}
      <POPdfPanel
        pdfSignedUrl={pdfSignedUrl}
        vendorName={vendorName}
        poNumber={po.po_number}
        poId={po.po_id}
      />
    </div>
  )
}
