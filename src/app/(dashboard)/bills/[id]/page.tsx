import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'

type LineItem = {
  line_id: string
  description: string | null
  quantity: number | null
  unit_cost: number | null
  extended_cost: number | null
  gl_account_id: string | null
  job_id: string | null
  sort_order: number
}

type Bill = {
  bill_id: string
  vendor_name_raw: string | null
  invoice_number: string | null
  invoice_date: string | null
  due_date: string | null
  total: number | null
  subtotal: number | null
  tax_amount: number | null
  status: string
  autopublish_hold_reason: string | null
  vendor_po_reference: string | null
  qb_reference_number: string | null
  pdf_url: string | null
  capture_source: string | null
  qb_sync_error: string | null
  bill_line_items: LineItem[]
}

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
      bill_id, vendor_name_raw, invoice_number, invoice_date, due_date,
      total, subtotal, tax_amount, status, autopublish_hold_reason,
      vendor_po_reference, qb_reference_number, pdf_url, capture_source, qb_sync_error,
      bill_line_items (
        line_id, description, quantity, unit_cost, extended_cost,
        gl_account_id, job_id, sort_order
      )
    `)
    .eq('bill_id', id)
    .single()

  if (error || !data) notFound()

  const bill = data as unknown as Bill
  const lineItems = [...(bill.bill_line_items ?? [])].sort((a, b) => a.sort_order - b.sort_order)

  return (
    <div className="flex h-full">
      {/* ── Left panel: bill details ── */}
      <div className="flex w-[520px] flex-none flex-col border-r border-gray-200 bg-white">
        {/* Header */}
        <div className="flex-none border-b border-gray-200 px-6 py-4">
          <Link
            href="/bills"
            className="mb-3 flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-gray-600 transition-colors"
          >
            <ChevronLeftIcon />
            Back to Bills
          </Link>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-lg font-semibold text-gray-900">
                {bill.vendor_name_raw ?? 'Unknown Vendor'}
              </h1>
              {bill.invoice_number && (
                <p className="mt-0.5 font-mono text-sm text-gray-400">{bill.invoice_number}</p>
              )}
            </div>
            <StatusBadge status={bill.status} />
          </div>
        </div>

        <div className="flex-1 overflow-auto px-6 py-5 space-y-6">
          {/* Hold reason banner */}
          {bill.autopublish_hold_reason && (
            <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-200">
              {bill.autopublish_hold_reason}
            </div>
          )}

          {/* Sync error banner */}
          {bill.status === 'sync_error' && bill.qb_sync_error && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-200">
              <span className="font-medium">QuickBooks sync failed: </span>
              {bill.qb_sync_error}
            </div>
          )}

          {/* Invoice details */}
          <section>
            <h2 className="mb-3 text-[11px] font-medium uppercase tracking-wider text-gray-400">
              Invoice Details
            </h2>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
              <DetailField label="Invoice Date" value={formatDate(bill.invoice_date)} />
              <DetailField label="Due Date" value={formatDate(bill.due_date)} />
              <DetailField label="Subtotal" value={bill.subtotal != null ? formatCurrency(bill.subtotal) : null} />
              <DetailField label="Tax" value={bill.tax_amount != null ? formatCurrency(bill.tax_amount) : null} />
              <DetailField
                label="Total"
                value={bill.total != null ? formatCurrency(bill.total) : null}
                valueClass="text-base font-semibold text-gray-900"
              />
              <DetailField label="Vendor PO / Ref" value={bill.vendor_po_reference} />
              <DetailField label="QB Reference #" value={bill.qb_reference_number} />
              <DetailField label="Captured Via" value={bill.capture_source ?? null} />
            </dl>
          </section>

          {/* Line items */}
          <section>
            <h2 className="mb-3 text-[11px] font-medium uppercase tracking-wider text-gray-400">
              Line Items
            </h2>
            {lineItems.length === 0 ? (
              <p className="text-sm text-gray-400">No line items extracted yet.</p>
            ) : (
              <div className="overflow-hidden rounded-lg border border-gray-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-gray-400">
                        Description
                      </th>
                      <th className="px-4 py-2.5 text-right text-[11px] font-medium uppercase tracking-wider text-gray-400">
                        Qty
                      </th>
                      <th className="px-4 py-2.5 text-right text-[11px] font-medium uppercase tracking-wider text-gray-400">
                        Unit Cost
                      </th>
                      <th className="px-4 py-2.5 text-right text-[11px] font-medium uppercase tracking-wider text-gray-400">
                        Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {lineItems.map((item) => (
                      <tr key={item.line_id}>
                        <td className="px-4 py-3 text-gray-700">
                          {item.description ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-gray-500">
                          {item.quantity != null ? item.quantity : '—'}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-gray-500">
                          {item.unit_cost != null ? formatCurrency(item.unit_cost) : '—'}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums font-medium text-gray-900">
                          {item.extended_cost != null ? formatCurrency(item.extended_cost) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>

      {/* ── Right panel: PDF viewer ── */}
      <div className="flex flex-1 flex-col overflow-hidden bg-gray-100">
        {bill.pdf_url ? (
          <iframe
            src={bill.pdf_url}
            className="h-full w-full border-0"
            title="Invoice PDF"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <PdfIcon />
              <p className="mt-3 text-sm font-medium text-gray-500">No PDF attached</p>
              <p className="mt-1 text-xs text-gray-400">
                PDFs captured via email will appear here
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function DetailField({
  label,
  value,
  valueClass,
}: {
  label: string
  value: string | null | undefined
  valueClass?: string
}) {
  return (
    <div>
      <dt className="text-xs font-medium text-gray-400">{label}</dt>
      <dd className={`mt-0.5 text-sm text-gray-900 ${valueClass ?? ''}`}>
        {value ?? <span className="text-gray-300">—</span>}
      </dd>
    </div>
  )
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return null
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

const STATUS_LABEL: Record<string, string> = {
  needs_review:      'Needs Review',
  draft:             'Needs Review',
  ready:             'Ready',
  sync_error:        'Sync Error',
  pending_job_match: 'Pending Job Match',
  publishing:        'Publishing',
  published:         'Published',
}

const STATUS_STYLES: Record<string, string> = {
  needs_review:      'bg-amber-50 text-amber-700 ring-amber-600/20',
  draft:             'bg-amber-50 text-amber-700 ring-amber-600/20',
  ready:             'bg-green-50 text-green-700 ring-green-600/20',
  sync_error:        'bg-red-50 text-red-700 ring-red-600/20',
  pending_job_match: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  publishing:        'bg-gray-50 text-gray-500 ring-gray-400/20',
  published:         'bg-green-50 text-green-700 ring-green-600/20',
}

function StatusBadge({ status }: { status: string }) {
  const label = STATUS_LABEL[status] ?? status
  const styles = STATUS_STYLES[status] ?? 'bg-gray-50 text-gray-600 ring-gray-400/20'
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${styles}`}>
      {label}
    </span>
  )
}

function ChevronLeftIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 18l-6-6 6-6" />
    </svg>
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
