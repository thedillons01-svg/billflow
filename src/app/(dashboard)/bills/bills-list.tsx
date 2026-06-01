'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { softDeleteBill, setBillStatus, updateBill } from './actions'
import { bulkPublish } from './bulk-actions'

type Bill = {
  bill_id: string
  vendor_id: string | null
  vendor_name_raw: string | null
  invoice_number: string | null
  invoice_date: string | null
  total: number | null
  status: string
  autopublish_hold_reason: string | null
  mark_as_paid: boolean | null
  bill_line_items?: { gl_account_id: string | null }[]
}

type Account = {
  qb_account_id: string
  name: string | null
}

const STATUS_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  draft:             { bg: '#FEF3C7', color: '#92400E', label: 'Needs Review' },
  ready:             { bg: '#D1FAE5', color: '#065F46', label: 'Ready' },
  sync_error:        { bg: '#FEE2E2', color: '#991B1B', label: 'Sync Error' },
  ocr_error:         { bg: '#FEE2E2', color: '#991B1B', label: 'OCR Error' },
  pending_job_match: { bg: '#EDE9FE', color: '#5B21B6', label: 'Pending' },
  publishing:        { bg: '#DBEAFE', color: '#1E40AF', label: 'Publishing' },
  published:         { bg: '#D1FAE5', color: '#065F46', label: 'Published' },
}

export function BillsList({
  bills,
  accounts,
  isInbox,
}: {
  bills: Bill[]
  accounts: Account[]
  isInbox: boolean
}) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [isPending, startTransition] = useTransition()
  const [editingVendor, setEditingVendor] = useState<string | null>(null)
  const [vendorDraft, setVendorDraft] = useState('')
  const [editingGl, setEditingGl] = useState<string | null>(null)
  const [glOverrides, setGlOverrides] = useState<Record<string, string>>({})
  const [bulkMessage, setBulkMessage] = useState<string | null>(null)

  const allSelected = bills.length > 0 && selected.size === bills.length
  const someSelected = selected.size > 0

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(bills.map(b => b.bill_id)))
    }
  }

  function toggleOne(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function handleBulkDelete() {
    if (!confirm(`Delete ${selected.size} bill${selected.size !== 1 ? 's' : ''}? They'll be recoverable from Trash for 30 days.`)) return
    startTransition(async () => {
      for (const id of selected) {
        await softDeleteBill(id)
      }
      setSelected(new Set())
      router.refresh()
    })
  }

  function handleBulkReady() {
    startTransition(async () => {
      for (const id of selected) {
        await setBillStatus(id, 'ready')
      }
      setSelected(new Set())
      router.refresh()
    })
  }

  function handleBulkPublish() {
    startTransition(async () => {
      const ids = Array.from(selected)
      const result = await bulkPublish(ids)
      setBulkMessage(`Published ${result.success} of ${ids.length} bills. ${result.failed > 0 ? `${result.failed} failed — check sync errors.` : ''}`)
      setSelected(new Set())
      router.refresh()
    })
  }

  function startVendorEdit(bill: Bill, e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setEditingVendor(bill.bill_id)
    setVendorDraft(bill.vendor_name_raw ?? '')
  }

  async function saveVendorEdit(billId: string) {
    await updateBill(billId, { vendor_name_raw: vendorDraft || null })
    setEditingVendor(null)
    router.refresh()
  }

  async function saveGlEdit(billId: string, glAccountId: string) {
    const res = await fetch('/api/bills/apply-gl', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ billId, glAccountId }),
    })
    if (res.ok) {
      setGlOverrides(prev => ({ ...prev, [billId]: glAccountId }))
      setEditingGl(null)
      router.refresh()
    }
  }

  return (
    <>
      {/* Bulk action bar */}
      {someSelected && (
        <div
          className="flex items-center gap-3 px-5 py-2"
          style={{
            background: '#EBF5EF',
            borderBottom: '0.5px solid #C3DEC9',
            position: 'sticky', top: 0, zIndex: 10,
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 500, color: '#1A3D2B' }}>
            {selected.size} selected
          </span>
          <div className="flex items-center gap-2 ml-2">
            {isInbox && (
              <>
                <BulkButton onClick={handleBulkReady} disabled={isPending} label="Mark Ready" />
                <BulkButton onClick={handleBulkPublish} disabled={isPending} label="Publish to QB" primary />
              </>
            )}
            <BulkButton onClick={handleBulkDelete} disabled={isPending} label="Delete" danger />
          </div>
          <button
            onClick={() => setSelected(new Set())}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#5A8C6A' }}
          >
            Clear selection
          </button>
        </div>
      )}

      {/* Bulk result message */}
      {bulkMessage && (
        <div
          className="flex items-center justify-between px-5 py-2"
          style={{ background: '#D1FAE5', borderBottom: '0.5px solid #6EE7B7' }}
        >
          <span style={{ fontSize: 12, color: '#065F46' }}>{bulkMessage}</span>
          <button
            onClick={() => setBulkMessage(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#065F46' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Column headers */}
      <div
        className="grid items-center px-5 py-2"
        style={{
          gridTemplateColumns: `${isInbox ? '24px ' : ''}1.6fr 0.9fr 0.7fr 0.9fr 1.2fr 36px 80px`,
          borderBottom: '0.5px solid var(--color-border-tertiary)',
        }}
      >
        {isInbox && (
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleAll}
            style={{ cursor: 'pointer', width: 14, height: 14 }}
          />
        )}
        {['Vendor', 'Invoice #', 'Date', 'Total', 'GL Account', '', 'Status'].map(h => (
          <span key={h} style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-secondary)' }}>
            {h}
          </span>
        ))}
      </div>

      {/* Rows */}
      {bills.map((bill, i) => {
        const badge = STATUS_BADGE[bill.status] ?? STATUS_BADGE.draft
        const isEditingVendorHere = editingVendor === bill.bill_id
        const isEditingGlHere = editingGl === bill.bill_id
        const isChecked = selected.has(bill.bill_id)

        return (
          <div
            key={bill.bill_id}
            className="grid items-center px-5 py-[10px]"
            style={{
              gridTemplateColumns: `${isInbox ? '24px ' : ''}1.6fr 0.9fr 0.7fr 0.9fr 1.2fr 36px 80px`,
              borderBottom: '0.5px solid var(--color-border-tertiary)',
              background: isChecked
                ? '#EBF5EF'
                : i % 2 === 0 ? 'white' : 'var(--color-background-secondary)',
            }}
          >
            {isInbox && (
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => toggleOne(bill.bill_id)}
                onClick={e => e.stopPropagation()}
                style={{ cursor: 'pointer', width: 14, height: 14 }}
              />
            )}

            {/* Vendor — inline edit on click, open-in-new-tab icon */}
            <div>
              {isEditingVendorHere ? (
                <input
                  autoFocus
                  value={vendorDraft}
                  onChange={e => setVendorDraft(e.target.value)}
                  onBlur={() => saveVendorEdit(bill.bill_id)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') saveVendorEdit(bill.bill_id)
                    if (e.key === 'Escape') setEditingVendor(null)
                  }}
                  onClick={e => e.stopPropagation()}
                  style={{
                    fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)',
                    border: '1px solid #2DB87A', borderRadius: 4,
                    padding: '1px 6px', width: '100%',
                  }}
                />
              ) : (
                <div className="flex items-center gap-1">
                  <p
                    style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)', cursor: 'text' }}
                    onClick={e => startVendorEdit(bill, e)}
                    title="Click to edit vendor name"
                  >
                    {bill.vendor_name_raw ?? 'Unknown Vendor'}
                  </p>
                  {bill.vendor_id && (
                    <a
                      href={`/vendors/${bill.vendor_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      title="Open vendor record"
                      style={{ color: 'var(--color-text-tertiary)', lineHeight: 1, flexShrink: 0 }}
                    >
                      <i className="ti ti-external-link" style={{ fontSize: 11 }} />
                    </a>
                  )}
                </div>
              )}
            </div>

            <Link href={`/bills/${bill.bill_id}`} style={{ textDecoration: 'none' }}>
              <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                {bill.invoice_number ?? '—'}
              </span>
            </Link>
            <Link href={`/bills/${bill.bill_id}`} style={{ textDecoration: 'none' }}>
              <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                {bill.invoice_date ? new Date(bill.invoice_date).toLocaleDateString() : '—'}
              </span>
            </Link>
            <Link href={`/bills/${bill.bill_id}`} style={{ textDecoration: 'none' }}>
              <span style={{ fontSize: 13, color: 'var(--color-text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                {bill.total != null ? `$${Number(bill.total).toFixed(2)}` : '—'}
              </span>
            </Link>

            {/* GL account — inline dropdown */}
            {(() => {
              const overrideId = glOverrides[bill.bill_id]
              const lineGlIds = (bill.bill_line_items ?? []).map(li => li.gl_account_id).filter(Boolean) as string[]
              const effectiveGlId = overrideId ?? (
                lineGlIds.length > 0 && lineGlIds.every(id => id === lineGlIds[0]) ? lineGlIds[0] : null
              )
              const glName = effectiveGlId ? (accounts.find(a => a.qb_account_id === effectiveGlId)?.name ?? effectiveGlId) : null
              const isMixed = !overrideId && lineGlIds.length > 0 && !lineGlIds.every(id => id === lineGlIds[0])

              return (
                <div onClick={e => e.stopPropagation()}>
                  {isEditingGlHere ? (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setEditingGl(null)} />
                      <select
                        autoFocus
                        defaultValue={effectiveGlId ?? ''}
                        className="relative z-50"
                        onKeyDown={e => { if (e.key === 'Escape') setEditingGl(null) }}
                        onChange={e => { if (e.target.value) saveGlEdit(bill.bill_id, e.target.value) }}
                        style={{
                          fontSize: 11, border: '1px solid #2DB87A', borderRadius: 4,
                          padding: '2px 4px', width: '100%', cursor: 'pointer',
                        }}
                      >
                        <option value="">— Select GL account —</option>
                        {accounts.map(a => (
                          <option key={a.qb_account_id} value={a.qb_account_id}>
                            {a.name ?? a.qb_account_id}
                          </option>
                        ))}
                      </select>
                    </>
                  ) : (
                    <button
                      onClick={() => setEditingGl(bill.bill_id)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontSize: 11, textAlign: 'left', padding: 0,
                        color: glName ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
                      }}
                      title="Click to apply a GL account to all lines"
                    >
                      {isMixed ? 'Mixed' : glName ?? 'Set GL…'}
                    </button>
                  )}
                </div>
              )
            })()}

            {/* Paid indicator */}
            <div title={bill.mark_as_paid ? 'Mark as Paid is on' : undefined}>
              {bill.mark_as_paid && (
                <span
                  style={{
                    display: 'inline-block',
                    background: '#D1FAE5', color: '#065F46',
                    borderRadius: 3, padding: '2px 5px',
                    fontSize: 9, fontWeight: 600, letterSpacing: '0.03em',
                    textTransform: 'uppercase',
                  }}
                >
                  Paid
                </span>
              )}
            </div>

            <Link href={`/bills/${bill.bill_id}`} style={{ textDecoration: 'none' }}>
              <span
                style={{
                  display: 'inline-block',
                  background: badge.bg, color: badge.color,
                  borderRadius: 4, padding: '3px 8px',
                  fontSize: 10, fontWeight: 500,
                }}
              >
                {badge.label}
              </span>
            </Link>
          </div>
        )
      })}
    </>
  )
}

function BulkButton({
  onClick, disabled, label, primary, danger,
}: {
  onClick: () => void
  disabled: boolean
  label: string
  primary?: boolean
  danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: primary ? '#2DB87A' : danger ? 'white' : 'white',
        color: primary ? 'white' : danger ? '#DC2626' : '#1A3D2B',
        border: `0.5px solid ${primary ? '#2DB87A' : danger ? '#FCA5A5' : '#C3DEC9'}`,
        borderRadius: 6, padding: '4px 12px',
        fontSize: 12, fontWeight: 500, cursor: 'pointer',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {label}
    </button>
  )
}
