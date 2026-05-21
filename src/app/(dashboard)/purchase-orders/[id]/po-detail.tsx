'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { closePO, deletePO } from '../actions'

type PO = {
  po_id: string
  company_id: string
  vendor_name: string
  po_number: string | null
  order_date: string | null
  expected_delivery_date: string | null
  job_id: string | null
  status: string
  qb_po_id: string | null
  qb_sync_error: string | null
  notes: string | null
}

type LineItem = {
  line_id: string
  description: string | null
  quantity_ordered: number | null
  quantity_received: number | null
  unit_cost: number | null
  extended_cost: number | null
  sort_order: number
}

type MatchedBill = {
  bill_id: string
  invoice_number: string | null
  total: number | null
  status: string
  vendor_name_raw: string | null
}

const STATUS_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  open:               { bg: '#D1FAE5', color: '#065F46',  label: 'Open' },
  partially_received: { bg: '#FEF3C7', color: '#92400E',  label: 'Partially Received' },
  received:           { bg: '#DBEAFE', color: '#1E40AF',  label: 'Received' },
  closed:             { bg: '#F3F4F6', color: '#374151',  label: 'Closed' },
}

const BILL_STATUS_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  draft:     { bg: '#FEF3C7', color: '#92400E', label: 'Needs Review' },
  ready:     { bg: '#D1FAE5', color: '#065F46', label: 'Ready' },
  published: { bg: '#D1FAE5', color: '#065F46', label: 'Published' },
  sync_error:{ bg: '#FEE2E2', color: '#991B1B', label: 'Sync Error' },
}

export function PODetail({
  po,
  lineItems,
  matchedBills,
  jobLabel,
  pushPosToQb = true,
}: {
  po: PO
  lineItems: LineItem[]
  matchedBills: MatchedBill[]
  jobLabel: string | null
  pushPosToQb?: boolean
}
) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [pushError, setPushError] = useState<string | null>(null)
  const [pushSuccess, setPushSuccess] = useState(false)
  const [localStatus, setLocalStatus] = useState(po.status)

  const badge = STATUS_BADGE[localStatus] ?? STATUS_BADGE.open
  const canReceive = ['open', 'partially_received'].includes(localStatus)
  const canClose = ['open', 'partially_received', 'received'].includes(localStatus)
  const isQBPushed = !!po.qb_po_id

  const handlePushToQB = () => {
    setPushError(null)
    startTransition(async () => {
      const res = await fetch('/api/quickbooks/push-po', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ poId: po.po_id }),
      })
      const json = await res.json()
      if (!res.ok) {
        setPushError(json.error ?? 'Push to QuickBooks failed')
      } else {
        setPushSuccess(true)
        router.refresh()
      }
    })
  }

  const handleClose = () => {
    if (!confirm('Mark this PO as closed? This will hide it from the Open queue.')) return
    startTransition(async () => {
      await closePO(po.po_id)
      setLocalStatus('closed')
      router.refresh()
    })
  }

  const handleDelete = () => {
    if (!confirm('Delete this purchase order? It will be removed from Purchasomatic but not from QuickBooks.')) return
    startTransition(async () => {
      await deletePO(po.po_id)
      router.push('/purchase-orders')
    })
  }

  const totalOrdered = lineItems.reduce((s, l) => s + (l.extended_cost ?? 0), 0)

  return (
    <>
      {/* Fixed header */}
      <div
        className="flex-none px-5 py-3"
        style={{ borderBottom: '0.5px solid var(--color-border-tertiary)' }}
      >
        <Link
          href="/purchase-orders"
          className="flex items-center gap-1 mb-2"
          style={{ fontSize: 12, color: 'var(--color-text-secondary)', textDecoration: 'none' }}
        >
          <i className="ti ti-arrow-left" style={{ fontSize: 12 }} />
          Back to Purchase Orders
        </Link>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 style={{ fontSize: 15, fontWeight: 500, color: 'var(--color-text-primary)' }}>
              {po.vendor_name}
            </h1>
            {po.po_number && (
              <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>
                PO #{po.po_number}
              </p>
            )}
          </div>
          <span
            style={{
              display: 'inline-block', flexShrink: 0,
              background: badge.bg, color: badge.color,
              borderRadius: 4, padding: '3px 8px',
              fontSize: 10, fontWeight: 500,
            }}
          >
            {badge.label}
          </span>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-auto">
        <div className="px-5 py-4 space-y-5">

          {/* QB push disabled notice */}
          {!pushPosToQb && (
            <div
              className="flex items-center gap-2"
              style={{ background: '#F3F4F6', border: '0.5px solid #E5E7EB', borderRadius: 6, padding: '10px 12px' }}
            >
              <i className="ti ti-info-circle" style={{ fontSize: 14, color: 'var(--color-text-secondary)' }} />
              <p style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                QuickBooks PO push is turned off. This PO is tracked in Purchasomatic only.
                <a href="/settings" style={{ color: '#2DB87A', marginLeft: 4 }}>Change in Settings</a>
              </p>
            </div>
          )}

          {/* QB sync error */}
          {po.qb_sync_error && (
            <div
              className="flex items-start gap-2"
              style={{ background: '#FEF2F2', border: '0.5px solid #FECACA', borderRadius: 6, padding: '10px 12px' }}
            >
              <i className="ti ti-alert-circle" style={{ fontSize: 15, color: '#DC2626', marginTop: 1, flexShrink: 0 }} />
              <div>
                <p style={{ fontSize: 12, fontWeight: 500, color: '#991B1B' }}>QuickBooks sync error</p>
                <p style={{ fontSize: 11, color: '#991B1B', marginTop: 2 }}>{po.qb_sync_error}</p>
              </div>
            </div>
          )}

          {/* Push success */}
          {pushSuccess && (
            <div
              className="flex items-center gap-2"
              style={{ background: '#D1FAE5', border: '0.5px solid #6EE7B7', borderRadius: 6, padding: '10px 12px' }}
            >
              <i className="ti ti-circle-check" style={{ fontSize: 15, color: '#059669' }} />
              <p style={{ fontSize: 12, color: '#065F46' }}>Purchase order pushed to QuickBooks successfully.</p>
            </div>
          )}

          {/* Push error */}
          {pushError && (
            <div
              className="flex items-center gap-2"
              style={{ background: '#FEF2F2', border: '0.5px solid #FECACA', borderRadius: 6, padding: '10px 12px' }}
            >
              <i className="ti ti-alert-circle" style={{ fontSize: 15, color: '#DC2626' }} />
              <p style={{ fontSize: 12, color: '#991B1B' }}>{pushError}</p>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {pushPosToQb && !isQBPushed && !pushSuccess && (
              <ActionButton
                onClick={handlePushToQB}
                disabled={isPending}
                primary
                icon="ti-upload"
              >
                Push to QuickBooks
              </ActionButton>
            )}
            {pushPosToQb && isQBPushed && (
              <span
                className="flex items-center gap-1.5"
                style={{ fontSize: 12, color: '#059669', fontWeight: 500 }}
              >
                <i className="ti ti-circle-check" style={{ fontSize: 14 }} />
                In QuickBooks
                <span style={{ fontWeight: 400, color: 'var(--color-text-tertiary)', fontSize: 11 }}>
                  #{po.qb_po_id}
                </span>
              </span>
            )}
            {canReceive && (
              <Link
                href={`/receiving/${po.po_id}`}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  background: 'white', color: '#1A3D2B',
                  border: '0.5px solid #C3DEC9',
                  borderRadius: 6, padding: '5px 12px',
                  fontSize: 12, fontWeight: 500,
                  textDecoration: 'none',
                }}
              >
                <i className="ti ti-package" style={{ fontSize: 13 }} />
                Receive Items
              </Link>
            )}
            {canClose && (
              <ActionButton onClick={handleClose} disabled={isPending} icon="ti-lock">
                Close PO
              </ActionButton>
            )}
            <ActionButton onClick={handleDelete} disabled={isPending} danger icon="ti-trash">
              Delete
            </ActionButton>
          </div>

          {/* PO details */}
          <Section title="Details">
            <div className="grid gap-y-3" style={{ gridTemplateColumns: '140px 1fr' }}>
              <DetailRow label="Order date" value={po.order_date ? new Date(po.order_date).toLocaleDateString() : '—'} />
              <DetailRow
                label="Expected delivery"
                value={po.expected_delivery_date ? new Date(po.expected_delivery_date).toLocaleDateString() : '—'}
              />
              {jobLabel && <DetailRow label="Job" value={jobLabel} />}
              {po.notes && <DetailRow label="Notes" value={po.notes} />}
            </div>
          </Section>

          {/* Line items */}
          <Section title={`Line Items${totalOrdered > 0 ? ` — $${totalOrdered.toFixed(2)} total` : ''}`}>
            {lineItems.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>No line items extracted.</p>
            ) : (
              <div style={{ border: '0.5px solid var(--color-border-tertiary)', borderRadius: 6, overflow: 'hidden' }}>
                {/* Header row */}
                <div
                  className="grid px-3 py-2"
                  style={{
                    gridTemplateColumns: '1fr 60px 60px 70px 70px',
                    background: 'var(--color-background-secondary)',
                    borderBottom: '0.5px solid var(--color-border-tertiary)',
                  }}
                >
                  {['Description', 'Ord', 'Rcvd', 'Unit', 'Total'].map(h => (
                    <span
                      key={h}
                      style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-secondary)' }}
                    >
                      {h}
                    </span>
                  ))}
                </div>
                {lineItems.map((li, i) => {
                  const ordered = li.quantity_ordered ?? 0
                  const received = li.quantity_received ?? 0
                  const recvStatus = received === 0 ? 'none' : received >= ordered ? 'full' : 'partial'
                  return (
                    <div
                      key={li.line_id}
                      className="grid items-center px-3 py-[9px]"
                      style={{
                        gridTemplateColumns: '1fr 60px 60px 70px 70px',
                        borderBottom: i < lineItems.length - 1 ? '0.5px solid var(--color-border-tertiary)' : 'none',
                        background: i % 2 === 0 ? 'white' : 'var(--color-background-secondary)',
                      }}
                    >
                      <span style={{ fontSize: 12, color: 'var(--color-text-primary)' }}>
                        {li.description ?? '—'}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                        {ordered > 0 ? ordered : '—'}
                      </span>
                      <span style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
                        <span style={{
                          color: recvStatus === 'full' ? '#059669' : recvStatus === 'partial' ? '#D97706' : 'var(--color-text-tertiary)',
                          fontWeight: recvStatus !== 'none' ? 500 : 400,
                        }}>
                          {received > 0 ? received : '—'}
                        </span>
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                        {li.unit_cost != null ? `$${Number(li.unit_cost).toFixed(2)}` : '—'}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--color-text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                        {li.extended_cost != null ? `$${Number(li.extended_cost).toFixed(2)}` : '—'}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Receiving legend */}
            {lineItems.some(l => (l.quantity_received ?? 0) > 0) && (
              <div className="flex items-center gap-4 mt-2">
                <span className="flex items-center gap-1" style={{ fontSize: 11, color: '#059669' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#059669', display: 'inline-block' }} />
                  Fully received
                </span>
                <span className="flex items-center gap-1" style={{ fontSize: 11, color: '#D97706' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#D97706', display: 'inline-block' }} />
                  Partially received
                </span>
              </div>
            )}
          </Section>

          {/* Matched bills */}
          {matchedBills.length > 0 && (
            <Section title="Matched Invoice">
              <div className="space-y-2">
                {matchedBills.map(bill => {
                  const billBadge = BILL_STATUS_BADGE[bill.status] ?? BILL_STATUS_BADGE.draft
                  return (
                    <Link
                      key={bill.bill_id}
                      href={`/bills/${bill.bill_id}`}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '10px 12px',
                        border: '0.5px solid var(--color-border-secondary)',
                        borderRadius: 6,
                        textDecoration: 'none',
                        background: 'var(--color-background-secondary)',
                      }}
                    >
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>
                          {bill.invoice_number ? `Invoice #${bill.invoice_number}` : 'Invoice'}
                        </p>
                        <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>
                          {bill.total != null ? `$${Number(bill.total).toFixed(2)}` : ''}{' '}
                          · View in Bills
                        </p>
                      </div>
                      <span
                        style={{
                          background: billBadge.bg, color: billBadge.color,
                          borderRadius: 4, padding: '2px 8px',
                          fontSize: 10, fontWeight: 500,
                        }}
                      >
                        {billBadge.label}
                      </span>
                    </Link>
                  )
                })}
              </div>
            </Section>
          )}

          {/* No matched bill yet */}
          {matchedBills.length === 0 && localStatus !== 'closed' && (
            <Section title="Matched Invoice">
              <p style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>
                No invoice matched yet. When a vendor emails an invoice that references this PO number, it will be linked here automatically.
              </p>
            </Section>
          )}

        </div>
      </div>
    </>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p style={{
        fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em',
        color: 'var(--color-text-secondary)', marginBottom: 10,
        paddingTop: 16, borderTop: '0.5px solid var(--color-border-tertiary)',
      }}>
        {title}
      </p>
      {children}
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{label}</span>
      <span style={{ fontSize: 12, color: 'var(--color-text-primary)' }}>{value}</span>
    </>
  )
}

function ActionButton({
  onClick, disabled, children, primary, danger, icon,
}: {
  onClick: () => void
  disabled: boolean
  children: React.ReactNode
  primary?: boolean
  danger?: boolean
  icon?: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        background: primary ? '#2DB87A' : 'white',
        color: primary ? 'white' : danger ? '#DC2626' : '#1A3D2B',
        border: `0.5px solid ${primary ? '#2DB87A' : danger ? '#FCA5A5' : '#C3DEC9'}`,
        borderRadius: 6, padding: '5px 12px',
        fontSize: 12, fontWeight: 500, cursor: 'pointer',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {icon && <i className={`ti ${icon}`} style={{ fontSize: 13 }} />}
      {children}
    </button>
  )
}
