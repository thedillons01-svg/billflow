import { createClient } from '@/lib/supabase/server'
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
      vendor_po_reference, qb_reference_number, description,
      mark_as_paid, payment_account_id, payment_method, payment_date, payment_ref_number,
      pdf_url, qb_sync_error, deleted_at,
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
    vendors: { auto_publish_enabled: boolean; invoices_processed: number } | null
    [key: string]: unknown
  }
  const lineItems = [...(bill.bill_line_items ?? [])].sort(
    (a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order
  )

  const [{ data: accounts }, { data: jobs }, { data: companySettings }] = await Promise.all([
    supabase
      .from('qb_accounts_cache')
      .select('id, qb_account_id, name, account_type')
      .eq('company_id', bill.company_id)
      .eq('is_hidden', false),
    supabase
      .from('qb_jobs_cache')
      .select('id, qb_job_id, job_number, job_name, customer_name')
      .eq('company_id', bill.company_id)
      .order('cached_at', { ascending: false }),
    supabase
      .from('companies')
      .select('job_costing_enabled')
      .single(),
  ])

  const jobCostingEnabled = companySettings?.job_costing_enabled ?? false

  let pdfSignedUrl: string | null = null
  if (bill.pdf_url) {
    const { data: signed } = await supabase.storage
      .from('bill-pdfs')
      .createSignedUrl(bill.pdf_url as string, 3600)
    pdfSignedUrl = signed?.signedUrl ?? null
  }

  return (
    <div className="flex" style={{ height: '100%' }}>
      {/* Left panel: review form */}
      <div
        style={{
          width: 520, flexShrink: 0,
          display: 'flex', flexDirection: 'column',
          borderRight: '0.5px solid var(--color-border-tertiary)',
          background: 'white',
        }}
      >
        <BillReviewForm
          bill={bill as unknown as Parameters<typeof BillReviewForm>[0]['bill']}
          lineItems={lineItems as unknown as Parameters<typeof BillReviewForm>[0]['lineItems']}
          accounts={(accounts ?? []) as Parameters<typeof BillReviewForm>[0]['accounts']}
          jobs={(jobs ?? []) as Parameters<typeof BillReviewForm>[0]['jobs']}
          vendorPromo={
            bill.vendor_id &&
            bill.vendors &&
            !bill.vendors.auto_publish_enabled &&
            bill.vendors.invoices_processed >= 5
              ? { vendorId: bill.vendor_id, invoicesProcessed: bill.vendors.invoices_processed }
              : null
          }
          jobCostingEnabled={jobCostingEnabled}
        />
      </div>

      {/* Right panel: PDF viewer */}
      <div className="flex-1 overflow-hidden" style={{ background: 'var(--color-background-secondary)' }}>
        {pdfSignedUrl ? (
          <iframe
            src={pdfSignedUrl}
            style={{ width: '100%', height: '100%', border: 'none' }}
            title="Invoice PDF"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <i className="ti ti-file" style={{ fontSize: 48, color: 'var(--color-text-tertiary)' }} />
              <p style={{ marginTop: 12, fontSize: 14, fontWeight: 500, color: 'var(--color-text-secondary)' }}>
                No PDF attached
              </p>
              <p style={{ marginTop: 4, fontSize: 12, color: 'var(--color-text-tertiary)' }}>
                PDFs captured via email will appear here automatically.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
