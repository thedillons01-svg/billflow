import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { notFound } from 'next/navigation'
import { BillReviewForm } from './bill-review-form'

export default async function BillDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('bills')
    .select(`
      bill_id, company_id, vendor_name_raw, invoice_number, invoice_date, due_date,
      total, line_items_total, status, autopublish_hold_reason,
      vendor_po_reference, qb_reference_number, description, bill_type,
      mark_as_paid, payment_account_id, payment_method, payment_date, payment_ref_number,
      pdf_url, qb_sync_error, deleted_at, reprocess_count, ocr_tier,
      vendor_id,
      vendors!bills_vendor_id_fkey(vendor_name_display, qb_vendor_id, auto_publish_enabled, invoices_processed),
      bill_line_items (
        line_id, description, quantity, unit_cost, extended_cost,
        gl_account_id, job_id, class_id, sort_order, is_tax_line, gl_account_source
      )
    `)
    .eq('bill_id', id)
    .single()

  if (error || !data || (data as Record<string, unknown>).deleted_at) notFound()

  const bill = data as unknown as {
    company_id: string
    vendor_id: string | null
    bill_line_items: { sort_order: number }[]
    vendors: { vendor_name_display: string | null; qb_vendor_id: string | null; auto_publish_enabled: boolean; invoices_processed: number } | null
    [key: string]: unknown
  }
  const lineItems = [...(bill.bill_line_items ?? [])].sort(
    (a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order
  )

  const [{ data: accounts }, { data: allJobsRaw }, { data: classes }, { data: companySettings }, { data: vendors }] = await Promise.all([
    supabase
      .from('qb_accounts_cache')
      .select('id, qb_account_id, name, account_type')
      .eq('company_id', bill.company_id)
      .eq('is_hidden', false),
    supabase
      .from('qb_jobs_cache')
      .select('id, qb_job_id, job_number, job_name, customer_name, parent_id, is_customer, status')
      .eq('company_id', bill.company_id)
      .order('customer_name')
      .order('job_name'),
    supabase
      .from('qb_classes_cache')
      .select('id, qb_class_id, name')
      .eq('company_id', bill.company_id)
      .eq('is_hidden', false)
      .order('name'),
    supabase
      .from('companies')
      .select('job_costing_enabled, class_tracking_enabled, job_tagging_level, show_field_tips')
      .single(),
    supabase
      .from('vendors')
      .select('vendor_id, vendor_name_display, vendor_name_extracted')
      .eq('company_id', bill.company_id)
      .eq('is_visible', true)
      .order('vendor_name_display'),
  ])

  const taggingLevel = companySettings?.job_tagging_level ?? 'sub_customers_only'

  // Filter jobs by tagging level; separate active from closed
  const allJobs = (allJobsRaw ?? []) as {
    id: string; qb_job_id: string; job_number: string | null; job_name: string | null
    customer_name: string | null; parent_id: string | null; is_customer: boolean; status: string
  }[]

  const jobs = allJobs.filter(j => {
    if (j.status !== 'active') return false
    if (taggingLevel === 'sub_customers_only') return !j.is_customer
    if (taggingLevel === 'customers_only')     return j.is_customer
    return true
  })

  const closedJobs = allJobs.filter(j => {
    if (j.status !== 'closed') return false
    if (taggingLevel === 'sub_customers_only') return !j.is_customer
    if (taggingLevel === 'customers_only')     return j.is_customer
    return true
  })

  const jobCostingEnabled = companySettings?.job_costing_enabled ?? false
  const classTrackingEnabled = companySettings?.class_tracking_enabled ?? false
  const showFieldTips = companySettings?.show_field_tips ?? true

  let pdfSignedUrl: string | null = null
  if (bill.pdf_url) {
    const serviceClient = createServiceClient()
    const { data: signed } = await serviceClient.storage
      .from('bill-pdfs')
      .createSignedUrl(bill.pdf_url as string, 3600)
    pdfSignedUrl = signed?.signedUrl ?? null
  }

  return (
    <div style={{ height: '100%' }}>
      <BillReviewForm
        bill={{
          ...(bill as unknown as Parameters<typeof BillReviewForm>[0]['bill']),
          vendor_name_display: bill.vendors?.vendor_name_display ?? null,
          vendor_qb_linked: bill.vendor_id ? !!bill.vendors?.qb_vendor_id : null,
        }}
        lineItems={lineItems as unknown as Parameters<typeof BillReviewForm>[0]['lineItems']}
        accounts={(accounts ?? []) as Parameters<typeof BillReviewForm>[0]['accounts']}
        jobs={(jobs ?? []) as Parameters<typeof BillReviewForm>[0]['jobs']}
        closedJobs={(closedJobs ?? []) as Parameters<typeof BillReviewForm>[0]['closedJobs']}
        vendorPromo={
          bill.vendor_id &&
          bill.vendors &&
          !bill.vendors.auto_publish_enabled &&
          bill.vendors.invoices_processed >= 5
            ? { vendorId: bill.vendor_id, invoicesProcessed: bill.vendors.invoices_processed }
            : null
        }
        classes={(classes ?? []) as Parameters<typeof BillReviewForm>[0]['classes']}
        vendors={(vendors ?? []) as Parameters<typeof BillReviewForm>[0]['vendors']}
        jobCostingEnabled={jobCostingEnabled}
        classTrackingEnabled={classTrackingEnabled}
        showFieldTips={showFieldTips}
        pdfSignedUrl={pdfSignedUrl}
      />
    </div>
  )
}
