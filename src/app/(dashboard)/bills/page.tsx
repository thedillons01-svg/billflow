import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { BillRow } from './bill-row'

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

  const bills = (data as Parameters<typeof BillRow>[0]['bill'][] | null) ?? []

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
                bills.map((bill) => <BillRow key={bill.bill_id} bill={bill} />)
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
