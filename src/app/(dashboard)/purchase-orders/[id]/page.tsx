import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { PODetail } from './po-detail'
import { POPdfPanel } from './po-pdf-panel'
import { POSplitShell } from './po-split-shell'

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
      vendor_id,
      vendors(vendor_name_display, qb_vendor_id),
      po_line_items(line_id, description, quantity_ordered, quantity_received, unit_cost, extended_cost, job_id, sort_order)
    `)
    .eq('po_id', id)
    .single()

  if (!po || po.deleted_at) notFound()

  // Matched bills, company settings, jobs, vendors — all in parallel
  const [{ data: matchedBills }, { data: companySettings }, { data: jobRows }, { data: vendorRows }] = await Promise.all([
    supabase
      .from('bills')
      .select('bill_id, invoice_number, total, status, vendor_name_raw, bill_line_items(job_id)')
      .eq('matched_po_id', id)
      .is('deleted_at', null),
    supabase
      .from('companies')
      .select('push_pos_to_qb, job_costing_enabled, job_tagging_level')
      .eq('company_id', po.company_id)
      .single(),
    supabase
      .from('qb_jobs_cache')
      .select('qb_job_id, job_number, job_name, customer_name, status, parent_id, is_customer')
      .eq('company_id', po.company_id)
      .order('job_number', { ascending: true }),
    supabase
      .from('vendors')
      .select('vendor_id, vendor_name_display, vendor_name_extracted, qb_vendor_id')
      .eq('company_id', po.company_id)
      .eq('is_visible', true)
      .order('vendor_name_display', { ascending: true }),
  ])

  // Filter jobs by tagging level setting
  const taggingLevel = companySettings?.job_tagging_level ?? 'sub_customers_only'
  const allJobs = (jobRows ?? []) as {
    qb_job_id: string; job_number: string | null; job_name: string | null
    customer_name: string | null; status: string; parent_id: string | null; is_customer: boolean
  }[]
  const activeJobs = allJobs.filter(j => {
    if (j.status !== 'active') return false
    if (taggingLevel === 'sub_customers_only') return !j.is_customer
    if (taggingLevel === 'customers_only') return j.is_customer
    return true
  })
  const closedJobs = allJobs.filter(j => {
    if (j.status !== 'closed') return false
    if (taggingLevel === 'sub_customers_only') return !j.is_customer
    if (taggingLevel === 'customers_only') return j.is_customer
    return true
  })
  const customers = allJobs.filter(j => j.status === 'active' && j.is_customer)

  let pdfSignedUrl: string | null = null
  if (po.pdf_url) {
    const { data: signed } = await supabase.storage
      .from('bill-pdfs')
      .createSignedUrl(po.pdf_url, 3600)
    pdfSignedUrl = signed?.signedUrl ?? null
  }

  const vendor = (po.vendors as unknown as { vendor_name_display: string | null; qb_vendor_id: string | null } | null)
  const vendorName = vendor?.vendor_name_display ?? po.vendor_name_raw ?? 'Unknown Vendor'

  const lineItems = ((po.po_line_items ?? []) as {
    line_id: string
    description: string | null
    quantity_ordered: number | null
    quantity_received: number | null
    unit_cost: number | null
    extended_cost: number | null
    job_id: string | null
    sort_order: number
  }[]).sort((a, b) => a.sort_order - b.sort_order)

  return (
    <POSplitShell
      left={
        <PODetail
          po={{
            po_id: po.po_id,
            company_id: po.company_id,
            vendor_id: po.vendor_id ?? null,
            vendor_name: vendorName,
            vendor_name_raw: po.vendor_name_raw ?? null,
            vendor_qb_linked: !!vendor?.qb_vendor_id,
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
            bill_line_items: { job_id: string | null }[]
          }[]}
          jobs={activeJobs}
          closedJobs={closedJobs}
          customers={customers}
          vendors={(vendorRows ?? []) as { vendor_id: string; vendor_name_display: string | null; vendor_name_extracted: string | null; qb_vendor_id: string | null }[]}
          jobCostingEnabled={companySettings?.job_costing_enabled ?? false}
          pushPosToQb={companySettings?.push_pos_to_qb ?? true}
        />
      }
      right={
        <POPdfPanel
          pdfSignedUrl={pdfSignedUrl}
          vendorName={vendorName}
          poNumber={po.po_number}
          poId={po.po_id}
        />
      }
    />
  )
}
