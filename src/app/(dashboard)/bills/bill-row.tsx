'use client'

import { useRouter } from 'next/navigation'

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

export function BillRow({ bill }: { bill: Bill }) {
  const router = useRouter()

  return (
    <tr
      onClick={() => router.push(`/bills/${bill.bill_id}`)}
      className="cursor-pointer transition-colors hover:bg-gray-50"
    >
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
