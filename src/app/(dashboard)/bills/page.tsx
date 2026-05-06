import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

type DbBillStatus =
  | 'needs_review'
  | 'draft'
  | 'ready'
  | 'pending_job_match'
  | 'publishing'
  | 'published'
  | 'sync_error'

type Bill = {
  bill_id: string
  vendor_name_raw: string | null
  invoice_number: string | null
  invoice_date: string | null
  total: number | null
  status: DbBillStatus
  autopublish_hold_reason: string | null
}

const REVIEW_STATUSES = ['needs_review', 'draft', 'ready', 'sync_error']
const PENDING_STATUSES = ['pending_job_match']

export default async function BillsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab } = await searchParams
  const activeTab = tab === 'pending' ? 'pending' : 'review'

  const supabase = await createClient()
  const statuses = activeTab === 'review' ? REVIEW_STATUSES : PENDING_STATUSES

  const { data, error } = await supabase
    .from('bills')
    .select('bill_id, vendor_name_raw, invoice_number, invoice_date, total, status, autopublish_hold_reason')
    .in('status', statuses)
    .order('created_at', { ascending: false })

  if (error) console.error('Error fetching bills:', error)

  const bills = (data as Bill[] | null) ?? []

  return (
    <div>
      {/* Page header — sticky so it stays visible while table scrolls */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-10 py-4">
        <h1 className="text-xl font-semibold text-gray-900">Bills</h1>
        <p className="mt-0.5 text-sm text-gray-400">Invoices that need your attention</p>
      </div>

      {/* Content */}
      <div className="px-10 py-6 max-w-6xl">
        {/* Tab bar */}
        <div className="border-b border-gray-200 mb-5">
          <nav className="-mb-px flex gap-6">
            <Link
              href="/bills"
              className={`pb-3 px-1 text-sm border-b-2 whitespace-nowrap transition-colors ${
                activeTab === 'review'
                  ? 'border-blue-600 text-blue-600 font-semibold'
                  : 'border-transparent text-gray-500 font-medium hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Needs Review
            </Link>
            <Link
              href="/bills?tab=pending"
              className={`pb-3 px-1 text-sm border-b-2 whitespace-nowrap transition-colors ${
                activeTab === 'pending'
                  ? 'border-blue-600 text-blue-600 font-semibold'
                  : 'border-transparent text-gray-500 font-medium hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Pending Job Match
            </Link>
          </nav>
        </div>

        {/* Bill list */}
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow">
          <table className="min-w-full">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-5 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-gray-400 w-[35%]">
                  Vendor
                </th>
                <th className="px-5 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-gray-400">
                  Invoice #
                </th>
                <th className="px-5 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-gray-400">
                  Invoice Date
                </th>
                <th className="px-5 py-3 text-right text-[11px] font-medium uppercase tracking-wider text-gray-400">
                  Total
                </th>
                <th className="px-5 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-gray-400">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {bills.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-14 text-center">
                    <p className="text-sm text-gray-400">
                      {activeTab === 'review'
                        ? "No bills need review — you're all caught up."
                        : 'No bills are waiting for a job match.'}
                    </p>
                  </td>
                </tr>
              ) : (
                bills.map((bill) => (
                  <tr key={bill.bill_id} className="cursor-pointer transition-colors hover:bg-gray-50">
                    <td className="px-5 py-3.5">
                      <div className="text-sm font-medium text-gray-900">
                        {bill.vendor_name_raw ?? '—'}
                      </div>
                      {bill.autopublish_hold_reason && (
                        <div className="mt-0.5 text-xs text-amber-600">{bill.autopublish_hold_reason}</div>
                      )}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-sm text-gray-500">
                      {bill.invoice_number ?? '—'}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-500">
                      {formatDate(bill.invoice_date)}
                    </td>
                    <td className="px-5 py-3.5 text-right text-sm font-medium tabular-nums text-gray-900">
                      {bill.total != null ? formatCurrency(bill.total) : '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={bill.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—'
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
