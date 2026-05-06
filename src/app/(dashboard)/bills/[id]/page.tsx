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
      total, status, autopublish_hold_reason, vendor_po_reference, qb_reference_number,
      pdf_url, qb_sync_error,
      bill_line_items (
        line_id, description, quantity, unit_cost, extended_cost,
        gl_account_id, job_id, sort_order
      )
    `)
    .eq('bill_id', id)
    .single()

  if (error || !data) notFound()

  const bill = data as Record<string, unknown> & { company_id: string; bill_line_items: { sort_order: number }[] }
  const lineItems = [...(bill.bill_line_items ?? [])].sort(
    (a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order
  )

  const [{ data: accounts }, { data: jobs }] = await Promise.all([
    supabase
      .from('qb_accounts_cache')
      .select('id, qb_account_id, name')
      .eq('company_id', bill.company_id),
    supabase
      .from('qb_jobs_cache')
      .select('id, qb_job_id, job_number, job_name, customer_name')
      .eq('company_id', bill.company_id)
      .order('cached_at', { ascending: false }),
  ])

  return (
    <div className="flex h-full">
      {/* Left panel: review form */}
      <div className="flex w-[520px] flex-none flex-col border-r border-gray-200 bg-white">
        <BillReviewForm
          bill={bill as unknown as Parameters<typeof BillReviewForm>[0]['bill']}
          lineItems={lineItems as unknown as Parameters<typeof BillReviewForm>[0]['lineItems']}
          accounts={(accounts ?? []) as Parameters<typeof BillReviewForm>[0]['accounts']}
          jobs={(jobs ?? []) as Parameters<typeof BillReviewForm>[0]['jobs']}
        />
      </div>

      {/* Right panel: PDF viewer */}
      <div className="flex flex-1 flex-col overflow-hidden bg-gray-100">
        {bill.pdf_url ? (
          <iframe
            src={bill.pdf_url as string}
            className="h-full w-full border-0"
            title="Invoice PDF"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <PdfIcon />
              <p className="mt-3 text-sm font-medium text-gray-500">No PDF attached</p>
              <p className="mt-1 text-xs text-gray-400">PDFs captured via email will appear here</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function PdfIcon() {
  return (
    <svg className="mx-auto h-12 w-12 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14,2 14,8 20,8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <line x1="10" y1="9" x2="8" y2="9" />
    </svg>
  )
}
