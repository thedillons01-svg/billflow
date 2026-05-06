'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useRef, useTransition } from 'react'
import { updateBill, updateLineItem, setBillStatus } from '../actions'

type Account = { id: string; qb_account_id: string; name: string | null }
type Job = { id: string; qb_job_id: string; job_number: string | null; job_name: string | null; customer_name: string | null }

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
  status: string
  autopublish_hold_reason: string | null
  vendor_po_reference: string | null
  qb_reference_number: string | null
  qb_sync_error: string | null
}

export function BillReviewForm({
  bill,
  lineItems,
  accounts,
  jobs,
}: {
  bill: Bill
  lineItems: LineItem[]
  accounts: Account[]
  jobs: Job[]
}) {
  const router = useRouter()
  const [localStatus, setLocalStatus] = useState(bill.status)
  const [isPending, startTransition] = useTransition()

  const handleMarkReady = () => {
    startTransition(async () => {
      await setBillStatus(bill.bill_id, 'ready')
      setLocalStatus('ready')
      router.refresh()
    })
  }

  const handleRevertDraft = () => {
    startTransition(async () => {
      await setBillStatus(bill.bill_id, 'draft')
      setLocalStatus('draft')
      router.refresh()
    })
  }

  const canMarkReady = localStatus === 'draft' || localStatus === 'needs_review'
  const canRevert = localStatus === 'ready'

  return (
    <>
      {/* Fixed header */}
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
          </div>
          <StatusBadge status={localStatus} />
        </div>
      </div>

      {/* Scrollable form content */}
      <div className="flex-1 overflow-auto px-6 py-5 space-y-6">
        {/* Banners */}
        {bill.autopublish_hold_reason && (
          <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-200">
            {bill.autopublish_hold_reason}
          </div>
        )}
        {localStatus === 'sync_error' && bill.qb_sync_error && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-200">
            <span className="font-medium">QuickBooks sync failed: </span>
            {bill.qb_sync_error}
          </div>
        )}

        {/* Invoice fields */}
        <section>
          <h2 className="mb-3 text-[11px] font-medium uppercase tracking-wider text-gray-400">
            Invoice Details
          </h2>
          <div className="grid grid-cols-2 gap-x-4 gap-y-4">
            <div className="col-span-2">
              <AutoSaveField
                label="Invoice #"
                initialValue={bill.invoice_number ?? ''}
                onSave={v => updateBill(bill.bill_id, { invoice_number: v || null })}
                placeholder="e.g. INV-12345"
              />
            </div>
            <AutoSaveField
              label="Invoice Date"
              type="date"
              initialValue={bill.invoice_date ?? ''}
              onSave={v => updateBill(bill.bill_id, { invoice_date: v || null })}
            />
            <AutoSaveField
              label="Due Date"
              type="date"
              initialValue={bill.due_date ?? ''}
              onSave={v => updateBill(bill.bill_id, { due_date: v || null })}
            />
            <AutoSaveField
              label="Vendor PO / Ref"
              initialValue={bill.vendor_po_reference ?? ''}
              onSave={v => updateBill(bill.bill_id, { vendor_po_reference: v || null })}
            />
            <AutoSaveField
              label="QB Reference #"
              initialValue={bill.qb_reference_number ?? ''}
              onSave={v => updateBill(bill.bill_id, { qb_reference_number: v || null })}
            />
            <div className="col-span-2">
              <AutoSaveField
                label="Total"
                type="number"
                initialValue={bill.total != null ? String(bill.total) : ''}
                onSave={v => updateBill(bill.bill_id, { total: v ? parseFloat(v) : null })}
                align="right"
                placeholder="0.00"
              />
            </div>
          </div>
        </section>

        {/* Line items */}
        <section>
          <h2 className="mb-3 text-[11px] font-medium uppercase tracking-wider text-gray-400">
            Line Items
          </h2>
          {lineItems.length === 0 ? (
            <p className="text-sm text-gray-400">No line items extracted yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="min-w-full text-sm">
                <thead className="border-b border-gray-200 bg-gray-50">
                  <tr>
                    <th className="px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-gray-400 w-[28%]">
                      Description
                    </th>
                    <th className="px-3 py-2.5 text-right text-[11px] font-medium uppercase tracking-wider text-gray-400 w-[9%]">
                      Qty
                    </th>
                    <th className="px-3 py-2.5 text-right text-[11px] font-medium uppercase tracking-wider text-gray-400 w-[13%]">
                      Unit Cost
                    </th>
                    <th className="px-3 py-2.5 text-right text-[11px] font-medium uppercase tracking-wider text-gray-400 w-[13%]">
                      Amount
                    </th>
                    <th className="px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-gray-400">
                      GL Account
                    </th>
                    <th className="px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-gray-400">
                      Job
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {lineItems.map((item) => (
                    <LineItemRow
                      key={item.line_id}
                      item={item}
                      accounts={accounts}
                      jobs={jobs}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Status actions */}
        {(canMarkReady || canRevert) && (
          <section className="flex gap-3 border-t border-gray-100 pt-5">
            {canMarkReady && (
              <button
                onClick={handleMarkReady}
                disabled={isPending}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {isPending ? 'Saving…' : 'Mark as Ready'}
              </button>
            )}
            {canRevert && (
              <button
                onClick={handleRevertDraft}
                disabled={isPending}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                {isPending ? 'Saving…' : 'Revert to Draft'}
              </button>
            )}
          </section>
        )}
      </div>
    </>
  )
}

// ── Line item row ────────────────────────────────────────────────────────────

function LineItemRow({
  item,
  accounts,
  jobs,
}: {
  item: LineItem
  accounts: Account[]
  jobs: Job[]
}) {
  return (
    <tr>
      <td className="px-1 py-1.5">
        <InlineInput
          initialValue={item.description ?? ''}
          onSave={v => updateLineItem(item.line_id, { description: v || null })}
          placeholder="Description"
        />
      </td>
      <td className="px-1 py-1.5">
        <InlineInput
          initialValue={item.quantity != null ? String(item.quantity) : ''}
          onSave={v => updateLineItem(item.line_id, { quantity: v ? parseFloat(v) : null })}
          align="right"
          placeholder="—"
        />
      </td>
      <td className="px-1 py-1.5">
        <InlineInput
          initialValue={item.unit_cost != null ? String(item.unit_cost) : ''}
          onSave={v => updateLineItem(item.line_id, { unit_cost: v ? parseFloat(v) : null })}
          align="right"
          placeholder="—"
        />
      </td>
      <td className="px-1 py-1.5">
        <InlineInput
          initialValue={item.extended_cost != null ? String(item.extended_cost) : ''}
          onSave={v => updateLineItem(item.line_id, { extended_cost: v ? parseFloat(v) : null })}
          align="right"
          placeholder="—"
        />
      </td>
      <td className="px-1 py-1.5">
        <InlineSelect
          initialValue={item.gl_account_id ?? ''}
          options={accounts.map(a => ({ value: a.qb_account_id, label: a.name ?? a.qb_account_id }))}
          onSave={v => updateLineItem(item.line_id, { gl_account_id: v || null })}
          placeholder="Select account…"
          emptyLabel="Connect QB"
        />
      </td>
      <td className="px-1 py-1.5">
        <InlineSelect
          initialValue={item.job_id ?? ''}
          options={jobs.map(j => ({
            value: j.qb_job_id,
            label: [j.job_number, j.job_name, j.customer_name].filter(Boolean).join(' – '),
          }))}
          onSave={v => updateLineItem(item.line_id, { job_id: v || null })}
          placeholder="Select job…"
          emptyLabel="Connect QB"
        />
      </td>
    </tr>
  )
}

// ── Shared field components ──────────────────────────────────────────────────

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

const BORDER: Record<SaveState, string> = {
  idle:   'border-gray-300 focus:border-blue-500 focus:ring-blue-500',
  saving: 'border-amber-400 focus:border-amber-400 focus:ring-amber-400',
  saved:  'border-green-400 focus:border-green-400 focus:ring-green-400',
  error:  'border-red-400 focus:border-red-400 focus:ring-red-400',
}

function AutoSaveField({
  label,
  type = 'text',
  initialValue,
  onSave,
  placeholder,
  align,
}: {
  label: string
  type?: 'text' | 'date' | 'number'
  initialValue: string
  onSave: (value: string) => Promise<void>
  placeholder?: string
  align?: 'right'
}) {
  const [value, setValue] = useState(initialValue)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleBlur = async () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setSaveState('saving')
    try {
      await onSave(value)
      setSaveState('saved')
      timerRef.current = setTimeout(() => setSaveState('idle'), 2000)
    } catch {
      setSaveState('error')
    }
  }

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <label className="text-xs font-medium text-gray-400">{label}</label>
        {saveState === 'saving' && <span className="text-[10px] text-amber-500">Saving…</span>}
        {saveState === 'saved'  && <span className="text-[10px] text-green-500">Saved ✓</span>}
        {saveState === 'error'  && <span className="text-[10px] text-red-500">Error saving</span>}
      </div>
      <input
        type={type}
        step={type === 'number' ? '0.01' : undefined}
        value={value}
        onChange={e => setValue(e.target.value)}
        onBlur={handleBlur}
        placeholder={placeholder}
        className={`w-full rounded-md border px-3 py-1.5 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-1 transition-colors ${BORDER[saveState]} ${align === 'right' ? 'text-right tabular-nums' : ''}`}
      />
    </div>
  )
}

const INLINE_BORDER: Record<SaveState, string> = {
  idle:   'border-transparent hover:border-gray-200 focus:border-blue-400 focus:ring-blue-400',
  saving: 'border-amber-300',
  saved:  'border-green-400',
  error:  'border-red-400',
}

function InlineInput({
  initialValue,
  onSave,
  placeholder,
  align,
}: {
  initialValue: string
  onSave: (value: string) => Promise<void>
  placeholder?: string
  align?: 'right'
}) {
  const [value, setValue] = useState(initialValue)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleBlur = async () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setSaveState('saving')
    try {
      await onSave(value)
      setSaveState('saved')
      timerRef.current = setTimeout(() => setSaveState('idle'), 1500)
    } catch {
      setSaveState('error')
    }
  }

  return (
    <input
      type="text"
      value={value}
      onChange={e => setValue(e.target.value)}
      onBlur={handleBlur}
      placeholder={placeholder}
      className={`w-full rounded border px-2 py-1 text-sm text-gray-700 bg-transparent placeholder:text-gray-300 focus:bg-white focus:outline-none focus:ring-1 transition-colors ${INLINE_BORDER[saveState]} ${align === 'right' ? 'text-right tabular-nums' : ''}`}
    />
  )
}

function InlineSelect({
  initialValue,
  options,
  onSave,
  placeholder,
  emptyLabel,
}: {
  initialValue: string
  options: { value: string; label: string }[]
  onSave: (value: string) => Promise<void>
  placeholder: string
  emptyLabel: string
}) {
  const [value, setValue] = useState(initialValue)

  if (options.length === 0) {
    return (
      <span className="block px-2 py-1 text-xs italic text-gray-300">{emptyLabel}</span>
    )
  }

  const handleChange = async (newValue: string) => {
    setValue(newValue)
    try {
      await onSave(newValue)
    } catch {
      setValue(initialValue)
    }
  }

  return (
    <select
      value={value}
      onChange={e => handleChange(e.target.value)}
      className="w-full rounded border border-transparent bg-transparent px-2 py-1 text-sm text-gray-700 hover:border-gray-200 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 transition-colors"
    >
      <option value="">{placeholder}</option>
      {options.map(opt => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  )
}

// ── Shared UI ────────────────────────────────────────────────────────────────

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
    <span className={`inline-flex flex-none items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${styles}`}>
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
