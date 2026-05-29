'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useRef, useTransition, useEffect, useCallback } from 'react'
import { updateBill, updateLineItem, setBillStatus, softDeleteBill, addLineItem, deleteLineItem, saveLineItemMapping, enableVendorAutoPublish, saveVendorPaymentDefaults, saveVendorClassDefault, saveVendorGlDefault, getVendorBillHistory, createVendorFromBill } from '../actions'

type Account = { id: string; qb_account_id: string; name: string | null; account_type: string | null }
type Job = { id: string; qb_job_id: string; job_number: string | null; job_name: string | null; customer_name: string | null }
type QBClass = { id: string; qb_class_id: string; name: string | null }

type LineItem = {
  line_id: string
  description: string | null
  quantity: number | null
  unit_cost: number | null
  extended_cost: number | null
  gl_account_id: string | null
  job_id: string | null
  class_id: string | null
  sort_order: number
  is_tax_line: boolean | null
  gl_account_source: string | null
}

type Vendor = { vendor_id: string; vendor_name_display: string | null; vendor_name_extracted: string | null }

type Bill = {
  bill_id: string
  company_id: string
  vendor_id: string | null
  vendor_name_raw: string | null
  vendor_name_display: string | null
  vendor_qb_linked: boolean | null
  invoice_number: string | null
  invoice_date: string | null
  due_date: string | null
  total: number | null
  line_items_total: number | null
  description: string | null
  bill_type: string | null
  status: string
  autopublish_hold_reason: string | null
  vendor_po_reference: string | null
  qb_reference_number: string | null
  qb_sync_error: string | null
  mark_as_paid: boolean | null
  payment_account_id: string | null
  payment_method: string | null
  payment_date: string | null
  payment_ref_number: string | null
  reprocess_count: number | null
  ocr_tier: number | null
}

const STATUS_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  draft:             { bg: '#FEF3C7', color: '#92400E', label: 'Needs Review' },
  ready:             { bg: '#D1FAE5', color: '#065F46', label: 'Ready' },
  sync_error:        { bg: '#FEE2E2', color: '#991B1B', label: 'Sync Error' },
  ocr_error:         { bg: '#FEE2E2', color: '#991B1B', label: 'OCR Error' },
  pending_job_match: { bg: '#EDE9FE', color: '#5B21B6', label: 'Pending Job Match' },
  publishing:        { bg: '#DBEAFE', color: '#1E40AF', label: 'Publishing' },
  published:         { bg: '#D1FAE5', color: '#065F46', label: 'Published' },
}

export function BillReviewForm({
  bill,
  lineItems: initialLineItems,
  accounts,
  jobs,
  classes,
  vendorPromo,
  vendors = [],
  jobCostingEnabled = false,
  classTrackingEnabled = false,
  pdfSignedUrl = null,
}: {
  bill: Bill
  lineItems: LineItem[]
  accounts: Account[]
  jobs: Job[]
  classes: QBClass[]
  vendorPromo?: { vendorId: string; invoicesProcessed: number } | null
  vendors?: Vendor[]
  jobCostingEnabled?: boolean
  classTrackingEnabled?: boolean
  pdfSignedUrl?: string | null
}) {
  const router = useRouter()
  const [localStatus, setLocalStatus] = useState(bill.status)
  const [localVendorId, setLocalVendorId] = useState(bill.vendor_id ?? '')
  const [swapped, setSwapped] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [publishError, setPublishError] = useState<string | null>(null)
  const [lineItems, setLineItems] = useState(initialLineItems)
  const [markAsPaid, setMarkAsPaid] = useState(bill.mark_as_paid ?? false)
  // Remember prompt: tracks which line triggered it and the new GL account id
  const [promoDismissed, setPromoDismissed] = useState(false)
  const [promoEnabled, setPromoEnabled] = useState(false)
  const [rememberPrompt, setRememberPrompt] = useState<{
    lineId: string; description: string; glAccountId: string; accountName: string
  } | null>(null)
  // Apply-to-all prompt for job selection
  const [jobApplyPrompt, setJobApplyPrompt] = useState<{
    jobId: string; jobLabel: string
  } | null>(null)
  // Apply-to-all prompt for header GL account
  const [headerGlApplyPrompt, setHeaderGlApplyPrompt] = useState<{
    glAccountId: string; accountName: string
  } | null>(null)
  // Inline pending prompts shown directly below header fields
  const [headerGlPending, setHeaderGlPending] = useState<{
    glAccountId: string; accountName: string
  } | null>(null)
  const [headerJobPending, setHeaderJobPending] = useState<{
    jobId: string; jobLabel: string
  } | null>(null)
  // Remember vendor default GL after header apply-to-all
  const [vendorGlRemember, setVendorGlRemember] = useState<{
    glAccountId: string; accountName: string
  } | null>(null)
  // Remember prompts for payment account and method
  const [paymentAccountRemember, setPaymentAccountRemember] = useState<{
    accountId: string; accountName: string
  } | null>(null)
  const [paymentMethodRemember, setPaymentMethodRemember] = useState<{
    method: string; methodLabel: string
  } | null>(null)
  // Remember prompt for class
  const [classRememberPrompt, setClassRememberPrompt] = useState<{
    lineId: string; classId: string; className: string
  } | null>(null)
  // Reprocess modal
  const [showReprocessModal, setShowReprocessModal] = useState(false)
  const [reprocessComment, setReprocessComment] = useState('')
  // Bill type local state for optimistic UI
  const [billType, setBillType] = useState(bill.bill_type ?? 'bill')
  const [vendorCreateError, setVendorCreateError] = useState<string | null>(null)

  // Invoice history popover
  const [showHistory, setShowHistory] = useState(false)
  const [historyBills, setHistoryBills] = useState<Array<{
    bill_id: string; invoice_number: string | null; invoice_date: string | null; total: number | null; status: string
  }> | null>(null)
  const historyRef = useRef<HTMLDivElement>(null)
  const formRef = useRef<HTMLDivElement>(null)
  const [formWidth, setFormWidth] = useState(720)

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = formRef.current?.offsetWidth ?? formWidth

    const onMove = (ev: MouseEvent) => {
      if (!formRef.current) return
      const delta = swapped ? startX - ev.clientX : ev.clientX - startX
      const next = Math.min(900, Math.max(320, startWidth + delta))
      formRef.current.style.width = next + 'px'
    }

    const onUp = (ev: MouseEvent) => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      const delta = swapped ? startX - ev.clientX : ev.clientX - startX
      setFormWidth(Math.min(900, Math.max(320, startWidth + delta)))
    }

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [swapped, formWidth])

  useEffect(() => {
    if (!showHistory) return
    const handler = (e: MouseEvent) => {
      if (historyRef.current && !historyRef.current.contains(e.target as Node)) {
        setShowHistory(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showHistory])

  const handleShowHistory = async () => {
    if (!bill.vendor_id) return
    setShowHistory(s => !s)
    if (historyBills === null) {
      const data = await getVendorBillHistory(bill.vendor_id, bill.bill_id)
      setHistoryBills(data)
    }
  }

  const expenseAccounts = accounts.filter(a =>
    ['Expense', 'Cost of Goods Sold', 'OtherCurrentLiability'].includes(a.account_type ?? '')
  )
  const paymentAccounts = accounts.filter(a =>
    ['Bank', 'CreditCard'].includes(a.account_type ?? '')
  )

  // Compute line items sum for reconciliation bar
  const lineItemsSum = lineItems.reduce((sum, li) => sum + (li.extended_cost ?? 0), 0)
  const invoiceTotal = bill.total ?? 0
  const totalsMatch = Math.abs(lineItemsSum - invoiceTotal) < 0.01

  const handlePublish = () => {
    setPublishError(null)
    startTransition(async () => {
      const res = await fetch('/api/quickbooks/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ billId: bill.bill_id }),
      })
      const json = await res.json()
      if (!res.ok) {
        setPublishError(json.error ?? 'Publish failed')
      } else {
        setLocalStatus('published')
        router.refresh()
      }
    })
  }

  const handleMarkReady = () => {
    startTransition(async () => {
      await setBillStatus(bill.bill_id, 'ready')
      setLocalStatus('ready')
    })
  }

  const handleDelete = () => {
    startTransition(async () => {
      await softDeleteBill(bill.bill_id)
      router.push('/bills')
    })
  }

  const handleAddLine = () => {
    startTransition(async () => {
      await addLineItem(bill.bill_id, bill.company_id)
      router.refresh()
    })
  }

  const handleDeleteLine = (lineId: string) => {
    startTransition(async () => {
      await deleteLineItem(lineId, bill.bill_id)
      setLineItems(ls => ls.filter(l => l.line_id !== lineId))
    })
  }

  const handleMarkAsPaidToggle = async (v: boolean) => {
    setMarkAsPaid(v)
    await updateBill(bill.bill_id, { mark_as_paid: v })
  }

  const handleReprocessSubmit = (comment: string) => {
    setShowReprocessModal(false)
    setReprocessComment('')
    startTransition(async () => {
      const res = await fetch(`/api/bills/${bill.bill_id}/reprocess`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: comment.trim() || undefined }),
      })
      if (res.ok) {
        router.refresh()
      } else {
        const json = await res.json()
        setPublishError(json.error ?? 'Reprocess failed')
      }
    })
  }

  const badge = STATUS_BADGE[localStatus] ?? STATUS_BADGE.draft
  const canPublish = ['ready', 'sync_error'].includes(localStatus)
  const canMarkReady = localStatus === 'draft'
  const isPublished = localStatus === 'published'
  const canReprocess = !isPublished

  const formPanel = (
    <div
      ref={formRef}
      style={{
        width: formWidth, flexShrink: 0,
        display: 'flex', flexDirection: 'column',
        background: 'white',
        order: swapped ? 2 : 0,
      }}
    >
      {/* Fixed header */}
      <div
        className="flex-none px-5 py-3"
        style={{ borderBottom: '0.5px solid var(--color-border-tertiary)' }}
      >
        <Link
          href="/bills"
          className="flex items-center gap-1 mb-2"
          style={{ fontSize: 12, color: 'var(--color-text-secondary)', textDecoration: 'none' }}
        >
          <i className="ti ti-arrow-left" style={{ fontSize: 12 }} />
          Back to Bills
        </Link>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 min-w-0">
            <h1 style={{ fontSize: 15, fontWeight: 500, color: 'var(--color-text-primary)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {bill.vendor_name_display ?? bill.vendor_name_raw ?? 'Unknown Vendor'}
            </h1>
            {bill.vendor_id && (
              <a
                href={`/vendors/${bill.vendor_id}`}
                target="_blank"
                rel="noopener noreferrer"
                title="Open vendor record"
                style={{ flexShrink: 0, color: 'var(--color-text-tertiary)', lineHeight: 1 }}
              >
                <i className="ti ti-external-link" style={{ fontSize: 13 }} />
              </a>
            )}
          </div>
          <div className="flex items-center gap-2" style={{ flexShrink: 0 }}>

            {bill.vendor_id && (
              <div style={{ position: 'relative' }} ref={historyRef}>
                <button
                  type="button"
                  onClick={handleShowHistory}
                  title="Previous invoices from this vendor"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 28, height: 28, border: '0.5px solid var(--color-border-secondary)',
                    borderRadius: 6, background: showHistory ? '#EBF5EF' : 'white', cursor: 'pointer',
                    color: showHistory ? '#1A3D2B' : 'var(--color-text-secondary)',
                  }}
                >
                  <i className="ti ti-history" style={{ fontSize: 14 }} />
                </button>
                {showHistory && (
                  <div style={{
                    position: 'absolute', top: 32, right: 0, zIndex: 50,
                    width: 320, background: 'white',
                    border: '0.5px solid var(--color-border-secondary)',
                    borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
                    overflow: 'hidden',
                  }}>
                    <div style={{ padding: '10px 14px', borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
                      <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Previous invoices from this vendor
                      </p>
                    </div>
                    {historyBills === null ? (
                      <div style={{ padding: 16, textAlign: 'center', fontSize: 12, color: 'var(--color-text-tertiary)' }}>Loading…</div>
                    ) : historyBills.length === 0 ? (
                      <div style={{ padding: 16, textAlign: 'center', fontSize: 12, color: 'var(--color-text-tertiary)' }}>No previous invoices</div>
                    ) : historyBills.map((b, i) => (
                      <Link
                        key={b.bill_id}
                        href={`/bills/${b.bill_id}`}
                        onClick={() => setShowHistory(false)}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '9px 14px',
                          background: i % 2 === 0 ? 'white' : 'var(--color-background-secondary)',
                          textDecoration: 'none',
                          borderTop: i === 0 ? 'none' : '0.5px solid var(--color-border-tertiary)',
                        }}
                      >
                        <div>
                          <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-primary)' }}>
                            {b.invoice_number ?? '—'}
                          </p>
                          <p style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
                            {b.invoice_date ? new Date(b.invoice_date).toLocaleDateString() : '—'}
                          </p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <p style={{ fontSize: 12, color: 'var(--color-text-primary)' }}>
                            {b.total != null ? `$${Number(b.total).toFixed(2)}` : '—'}
                          </p>
                          <p style={{ fontSize: 10, color: STATUS_BADGE[b.status]?.color ?? 'var(--color-text-secondary)' }}>
                            {STATUS_BADGE[b.status]?.label ?? b.status}
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
            <button
              type="button"
              onClick={() => setSwapped(s => !s)}
              title="Swap panels"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 28, height: 28, border: '0.5px solid var(--color-border-secondary)',
                borderRadius: 6, background: 'white', cursor: 'pointer',
                color: 'var(--color-text-secondary)',
              }}
            >
              <i className="ti ti-layout-columns" style={{ fontSize: 14 }} />
            </button>
            <span style={{
              display: 'inline-block',
              background: badge.bg, color: badge.color,
              borderRadius: 4, padding: '3px 8px',
              fontSize: 10, fontWeight: 500,
            }}>
              {badge.label}
            </span>
          </div>
        </div>
        {/* Second header row: hold reason + document type */}
        <div className="flex items-center justify-between gap-3" style={{ marginTop: 6 }}>
          <div style={{ minWidth: 0 }}>
            {bill.autopublish_hold_reason && bill.autopublish_hold_reason !== 'No vendor record linked to this bill.' && localStatus !== 'pending_job_match' && (
              <p style={{ fontSize: 11, color: '#92400E', display: 'flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                <i className="ti ti-info-circle" style={{ fontSize: 11, flexShrink: 0 }} />
                {bill.autopublish_hold_reason}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3" style={{ flexShrink: 0 }}>
            {([
              { value: 'bill', label: 'Invoice / Bill' },
              { value: 'credit_note', label: 'Credit Note' },
            ] as const).map(opt => (
              <label
                key={opt.value}
                className="flex items-center gap-1"
                style={{ cursor: isPublished ? 'default' : 'pointer', fontSize: 11, color: billType === opt.value ? 'var(--color-text-primary)' : 'var(--color-text-secondary)', userSelect: 'none' }}
              >
                <input
                  type="radio"
                  name={`bill_type_${bill.bill_id}`}
                  value={opt.value}
                  checked={billType === opt.value}
                  disabled={isPublished}
                  onChange={() => { if (!isPublished) { setBillType(opt.value); updateBill(bill.bill_id, { bill_type: opt.value }) } }}
                  style={{ accentColor: '#2DB87A', cursor: isPublished ? 'default' : 'pointer' }}
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Scrollable form */}
      <div className="flex-1 overflow-auto">
        <div className="px-5 py-4 space-y-5">
          {/* Auto-publish promotion banner */}
          {vendorPromo && !promoDismissed && !promoEnabled && (
            <div
              className="flex items-start gap-3"
              style={{
                background: '#EBF5EF',
                border: '1.5px solid #2DB87A',
                borderRadius: 8,
                padding: '12px 14px',
              }}
            >
              <i className="ti ti-rocket" style={{ fontSize: 18, color: '#2DB87A', marginTop: 1, flexShrink: 0 }} />
              <div className="flex-1">
                <p style={{ fontSize: 13, fontWeight: 600, color: '#1A3D2B' }}>
                  Ready for auto-publish
                </p>
                <p style={{ fontSize: 12, color: '#2D6A4F', marginTop: 2, lineHeight: 1.5 }}>
                  {vendorPromo.invoicesProcessed} invoices from this vendor have processed accurately.
                  Enable auto-publish and future invoices will go straight to QuickBooks — no review needed.
                </p>
                <div className="flex items-center gap-2 mt-3">
                  <button
                    onClick={() => {
                      startTransition(async () => {
                        await enableVendorAutoPublish(vendorPromo.vendorId)
                        setPromoEnabled(true)
                      })
                    }}
                    disabled={isPending}
                    style={{
                      background: '#2DB87A', color: 'white',
                      border: 'none', borderRadius: 6, padding: '5px 14px',
                      fontSize: 12, fontWeight: 500, cursor: 'pointer',
                      opacity: isPending ? 0.6 : 1,
                    }}
                  >
                    Enable auto-publish
                  </button>
                  <button
                    onClick={() => setPromoDismissed(true)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: 12, color: '#5A8C6A',
                    }}
                  >
                    Not yet
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Auto-publish enabled confirmation */}
          {promoEnabled && (
            <div
              className="flex items-center gap-2"
              style={{
                background: '#D1FAE5',
                border: '0.5px solid #6EE7B7',
                borderRadius: 6,
                padding: '10px 14px',
              }}
            >
              <i className="ti ti-circle-check" style={{ fontSize: 15, color: '#059669' }} />
              <p style={{ fontSize: 12, color: '#065F46' }}>
                Auto-publish enabled for this vendor. Future invoices will publish automatically.
              </p>
            </div>
          )}

          {/* Banners */}
          {localStatus === 'pending_job_match' && (
            <div
              className="flex items-center justify-between"
              style={{ background: '#EDE9FE', border: '0.5px solid #C4B5FD', borderRadius: 6, padding: '10px 12px' }}
            >
              <div>
                <p style={{ fontSize: 12, fontWeight: 500, color: '#5B21B6' }}>Waiting for job match</p>
                <p style={{ fontSize: 11, color: '#6D28D9', marginTop: 2 }}>
                  Retry checks every 2 hours during business hours. Use Find Match to retry now.
                </p>
              </div>
              <button
                onClick={() => {
                  startTransition(async () => {
                    const res = await fetch(`/api/bills/${bill.bill_id}/find-match`, { method: 'POST' })
                    if (res.ok) {
                      const json = await res.json()
                      if (json.matched) {
                        setLocalStatus('ready')
                      }
                      router.refresh()
                    }
                  })
                }}
                disabled={isPending}
                style={{
                  background: '#7C3AED', color: 'white',
                  border: 'none', borderRadius: 6, padding: '5px 12px',
                  fontSize: 12, fontWeight: 500, cursor: 'pointer', flexShrink: 0,
                  opacity: isPending ? 0.6 : 1,
                }}
              >
                {isPending ? 'Searching…' : 'Find Match'}
              </button>
            </div>
          )}
          {localStatus === 'sync_error' && bill.qb_sync_error && (
            <div style={{ background: '#FEE2E2', border: '0.5px solid #FCA5A5', borderRadius: 6, padding: '10px 12px', fontSize: 12, color: '#991B1B' }}>
              <strong>QuickBooks sync failed: </strong>{bill.qb_sync_error}
            </div>
          )}
          {localStatus === 'ocr_error' && (
            <div
              className="flex items-start justify-between gap-3"
              style={{ background: '#FEE2E2', border: '0.5px solid #FCA5A5', borderRadius: 6, padding: '10px 12px' }}
            >
              <div>
                <p style={{ fontSize: 12, fontWeight: 500, color: '#991B1B' }}>OCR extraction failed</p>
                <p style={{ fontSize: 11, color: '#B91C1C', marginTop: 2 }}>
                  The PDF could not be read automatically. You can reprocess it (no credit charge) or fill in the fields manually below.
                </p>
              </div>
              <button
                onClick={() => setShowReprocessModal(true)}
                disabled={isPending}
                style={{
                  background: '#DC2626', color: 'white',
                  border: 'none', borderRadius: 6, padding: '5px 12px',
                  fontSize: 12, fontWeight: 500, cursor: 'pointer', flexShrink: 0,
                  opacity: isPending ? 0.6 : 1,
                }}
              >
                {isPending ? 'Reprocessing…' : 'Reprocess'}
              </button>
            </div>
          )}

          {/* INVOICE DETAILS */}
          <Section title="Invoice Details">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Field label="Vendor" helper="The vendor this invoice is matched to. Change if the OCR matched the wrong vendor.">
                  <select
                    value={localVendorId}
                    onChange={e => {
                      setLocalVendorId(e.target.value)
                      updateBill(bill.bill_id, { vendor_id: e.target.value || null })
                    }}
                    style={selectStyle}
                  >
                    <option value="">
                      {bill.vendor_name_raw ? `— ${bill.vendor_name_raw} (unmatched) —` : '— Unmatched —'}
                    </option>
                    {vendors.map(v => (
                      <option key={v.vendor_id} value={v.vendor_id}>
                        {v.vendor_name_display ?? v.vendor_name_extracted ?? v.vendor_id}
                      </option>
                    ))}
                  </select>
                  {localVendorId === '' && (
                    <p style={{ marginTop: 5, fontSize: 11, color: '#92400E', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <i className="ti ti-alert-triangle" style={{ fontSize: 12 }} />
                      No vendor record linked — required to publish to QuickBooks.
                    </p>
                  )}
                  {localVendorId !== '' && bill.vendor_qb_linked === false && (
                    <p style={{ marginTop: 5, fontSize: 11, color: '#92400E', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <i className="ti ti-alert-triangle" style={{ fontSize: 12 }} />
                      Vendor has no QuickBooks link — bills cannot be published.{' '}
                      <a href={`/vendors/${localVendorId}?tab=general`} target="_blank" rel="noopener noreferrer" style={{ color: '#92400E', fontWeight: 500 }}>
                        Fix in vendor settings
                      </a>
                    </p>
                  )}
                  {localVendorId === '' && bill.vendor_name_raw && (
                    <>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => {
                          setVendorCreateError(null)
                          startTransition(async () => {
                            try {
                              const newId = await createVendorFromBill(bill.bill_id, bill.company_id, bill.vendor_name_raw!)
                              setLocalVendorId(newId)
                              router.refresh()
                            } catch (err) {
                              setVendorCreateError(err instanceof Error ? err.message : 'Failed to create vendor')
                            }
                          })
                        }}
                        style={{
                          marginTop: 6,
                          background: 'none', border: 'none', padding: 0,
                          fontSize: 12, color: '#2DB87A', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', gap: 4,
                          opacity: isPending ? 0.6 : 1,
                        }}
                      >
                        <i className="ti ti-plus" style={{ fontSize: 12 }} />
                        {isPending ? 'Creating…' : `Create "${bill.vendor_name_raw}" as new vendor`}
                      </button>
                      {vendorCreateError && (
                        <p style={{ marginTop: 4, fontSize: 11, color: '#991B1B', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <i className="ti ti-circle-x" style={{ fontSize: 12 }} />
                          {vendorCreateError}
                        </p>
                      )}
                    </>
                  )}
                </Field>
              </div>
              <Field label="Invoice #" helper="The invoice number from the vendor PDF. Used for duplicate detection.">
                <AutoSaveInput
                  initialValue={bill.invoice_number ?? ''}
                  onSave={v => updateBill(bill.bill_id, { invoice_number: v || null })}
                  placeholder="e.g. INV-12345"
                />
              </Field>
              <Field label="Invoice Date" helper="Date on the vendor invoice.">
                <AutoSaveInput type="date" initialValue={bill.invoice_date ?? ''} onSave={v => updateBill(bill.bill_id, { invoice_date: v || null })} />
              </Field>
              <Field label="Due Date" helper="Payment due date. Can be blank.">
                <AutoSaveInput type="date" initialValue={bill.due_date ?? ''} onSave={v => updateBill(bill.bill_id, { due_date: v || null })} />
              </Field>
              <Field label="Invoice Total" helper="The total amount from the invoice header. Must match the line items sum for auto-publish.">
                <AutoSaveInput type="number" initialValue={bill.total != null ? String(bill.total) : ''} onSave={v => updateBill(bill.bill_id, { total: v ? parseFloat(v) : null })} align="right" placeholder="0.00" />
              </Field>
              <div className="col-span-2">
                <Field label="Vendor PO / Reference" helper="The purchase order or reference number from the invoice. Used for job matching and optionally copied to QB Ref No field.">
                  <AutoSaveInput initialValue={bill.vendor_po_reference ?? ''} onSave={v => updateBill(bill.bill_id, { vendor_po_reference: v || null })} />
                </Field>
              </div>
              <div className="col-span-2">
                <Field label="Memo / Description" helper="Pre-populates the QB bill memo field. Defaults to vendor name if blank.">
                  <AutoSaveInput initialValue={bill.description ?? ''} onSave={v => updateBill(bill.bill_id, { description: v || null })} placeholder="Memo on QB bill" />
                </Field>
              </div>
              {lineItems.length > 0 && (
                <div className="col-span-2">
                  <Field label="GL Account (all lines)" helper="Sets the GL account for all line items at once. Useful when all items go to the same account. Individual line items can still be changed after.">
                    <InlineSelect
                      initialValue={
                        lineItems.every(li => li.gl_account_id === lineItems[0].gl_account_id)
                          ? (lineItems[0].gl_account_id ?? '')
                          : ''
                      }
                      options={expenseAccounts.map(a => ({ value: a.qb_account_id, label: a.name ?? a.qb_account_id }))}
                      onSave={async (v) => {
                        if (!v) return
                        const account = expenseAccounts.find(a => a.qb_account_id === v)
                        const name = account?.name ?? v
                        if (lineItems.length > 1) {
                          setHeaderGlPending({ glAccountId: v, accountName: name })
                        } else if (lineItems.length === 1) {
                          await updateLineItem(lineItems[0].line_id, { gl_account_id: v, gl_account_source: 'manual' })
                          if (bill.vendor_id) {
                            const desc = lineItems[0].description
                            if (desc) setRememberPrompt({ lineId: lineItems[0].line_id, description: desc, glAccountId: v, accountName: name })
                          }
                          router.refresh()
                        }
                      }}
                      placeholder={lineItems.every(li => li.gl_account_id === lineItems[0].gl_account_id) ? 'GL account…' : 'Mixed — select to apply all'}
                      emptyLabel="Connect QB"
                    />
                    {vendorGlRemember && (
                      <div className="flex items-center gap-2" style={{ marginTop: 6, padding: '6px 10px', background: '#FFFBEB', border: '0.5px solid #FDE68A', borderRadius: 6 }}>
                        <i className="ti ti-bulb" style={{ fontSize: 12, color: '#D97706', flexShrink: 0 }} />
                        <span style={{ fontSize: 12, color: '#92400E', flex: 1 }}>
                          Remember <strong>{vendorGlRemember.accountName}</strong> as the default GL account for this vendor?
                        </span>
                        <button
                          onClick={async () => {
                            await saveVendorGlDefault(bill.vendor_id!, vendorGlRemember.glAccountId)
                            setVendorGlRemember(null)
                          }}
                          style={{ fontSize: 12, fontWeight: 500, color: '#1A3D2B', background: '#D1FAE5', border: 'none', borderRadius: 4, padding: '3px 10px', cursor: 'pointer', flexShrink: 0 }}
                        >
                          Yes
                        </button>
                        <button
                          onClick={() => setVendorGlRemember(null)}
                          style={{ fontSize: 12, color: '#92400E', background: 'none', border: 'none', cursor: 'pointer', padding: '3px 6px' }}
                        >
                          No
                        </button>
                      </div>
                    )}
                    {headerGlPending && (
                      <div className="flex items-center gap-2" style={{ marginTop: 6, padding: '6px 10px', background: '#FFFBEB', border: '0.5px solid #FDE68A', borderRadius: 6 }}>
                        <i className="ti ti-corner-down-right" style={{ fontSize: 12, color: '#D97706', flexShrink: 0 }} />
                        <span style={{ fontSize: 12, color: '#92400E', flex: 1 }}>
                          Apply <strong>{headerGlPending.accountName}</strong> to all {lineItems.length} lines?
                        </span>
                        <button
                          onClick={async () => {
                            const pending = headerGlPending
                            setHeaderGlPending(null)
                            setLineItems(ls => ls.map(li => ({ ...li, gl_account_id: pending.glAccountId, gl_account_source: 'manual' })))
                            for (const li of lineItems) {
                              await updateLineItem(li.line_id, { gl_account_id: pending.glAccountId, gl_account_source: 'manual' })
                            }
                            if (bill.vendor_id) {
                              setVendorGlRemember({ glAccountId: pending.glAccountId, accountName: pending.accountName })
                            }
                            router.refresh()
                          }}
                          style={{ fontSize: 12, fontWeight: 500, color: '#92400E', background: '#FEF3C7', border: 'none', borderRadius: 4, padding: '3px 10px', cursor: 'pointer', flexShrink: 0 }}
                        >
                          Yes, all {lineItems.length}
                        </button>
                        <button
                          onClick={() => setHeaderGlPending(null)}
                          style={{ fontSize: 12, color: '#92400E', background: 'none', border: 'none', cursor: 'pointer', padding: '3px 6px' }}
                        >
                          No
                        </button>
                      </div>
                    )}
                  </Field>
                </div>
              )}
              {jobCostingEnabled && lineItems.length > 0 && (
                <div className="col-span-2">
                  <Field label="Job (all lines)" helper="Sets the job for all line items at once. Individual line items can still be changed after.">
                    <InlineSelect
                      initialValue={
                        lineItems.every(li => li.job_id === lineItems[0].job_id)
                          ? (lineItems[0].job_id ?? '')
                          : ''
                      }
                      options={jobs.map(j => ({
                        value: j.qb_job_id,
                        label: [j.job_number, j.job_name, j.customer_name].filter(Boolean).join(' – '),
                      }))}
                      onSave={async (v) => {
                        if (!v) return
                        const job = jobs.find(j => j.qb_job_id === v)
                        const label = [job?.job_number, job?.job_name, job?.customer_name].filter(Boolean).join(' – ') || v
                        if (lineItems.length > 1) {
                          setHeaderJobPending({ jobId: v, jobLabel: label })
                        } else if (lineItems.length === 1) {
                          await updateLineItem(lineItems[0].line_id, { job_id: v })
                          router.refresh()
                        }
                      }}
                      placeholder={lineItems.every(li => li.job_id === lineItems[0].job_id) ? 'Job…' : 'Mixed — select to apply all'}
                      emptyLabel="—"
                    />
                    {headerJobPending && (
                      <div className="flex items-center gap-2" style={{ marginTop: 6, padding: '6px 10px', background: '#EEF2FF', border: '0.5px solid #C7D2FE', borderRadius: 6 }}>
                        <i className="ti ti-corner-down-right" style={{ fontSize: 12, color: '#4338CA', flexShrink: 0 }} />
                        <span style={{ fontSize: 12, color: '#3730A3', flex: 1 }}>
                          Apply <strong>{headerJobPending.jobLabel}</strong> to all {lineItems.length} lines?
                        </span>
                        <button
                          onClick={async () => {
                            const pending = headerJobPending
                            setHeaderJobPending(null)
                            setLineItems(ls => ls.map(li => ({ ...li, job_id: pending.jobId })))
                            for (const li of lineItems) {
                              await updateLineItem(li.line_id, { job_id: pending.jobId })
                            }
                            router.refresh()
                          }}
                          style={{ fontSize: 12, fontWeight: 500, color: 'white', background: '#4338CA', border: 'none', borderRadius: 4, padding: '3px 10px', cursor: 'pointer', flexShrink: 0 }}
                        >
                          Yes, all {lineItems.length}
                        </button>
                        <button
                          onClick={() => setHeaderJobPending(null)}
                          style={{ fontSize: 12, color: '#3730A3', background: 'none', border: 'none', cursor: 'pointer', padding: '3px 6px' }}
                        >
                          No
                        </button>
                      </div>
                    )}
                  </Field>
                </div>
              )}
            </div>
          </Section>

          {/* LINE ITEMS */}
          <Section title="Line Items">
            {lineItems.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>No line items extracted yet.</p>
            ) : (
              <div style={{ border: '0.5px solid var(--color-border-tertiary)', borderRadius: 6, overflow: 'hidden' }}>
                <div className="grid" style={{ gridTemplateColumns: [
                      '3fr 0.6fr 0.8fr 0.9fr 1.4fr',
                      jobCostingEnabled ? ' 1.2fr' : '',
                      classTrackingEnabled ? ' 1fr' : '',
                      ' 24px',
                    ].join(''), background: 'var(--color-background-secondary)', borderBottom: '0.5px solid var(--color-border-tertiary)', padding: '6px 8px' }}>
                  {([
                    { label: 'Description', align: 'left' },
                    { label: 'Qty', align: 'right' },
                    { label: 'Unit', align: 'right' },
                    { label: 'Amount', align: 'right' },
                    { label: 'GL Account', align: 'left' },
                    ...(jobCostingEnabled ? [{ label: 'Job', align: 'left' }] : []),
                    ...(classTrackingEnabled ? [{ label: 'Class', align: 'left' }] : []),
                    { label: '', align: 'left' },
                  ] as { label: string; align: 'left' | 'right' }[]).map(h => (
                    <span key={h.label} style={{ fontSize: 9, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-secondary)', textAlign: h.align }}>{h.label}</span>
                  ))}
                </div>
                {lineItems.map((item, i) => (
                  <div
                    key={item.line_id}
                    className="grid items-center"
                    style={{
                      gridTemplateColumns: [
                      '3fr 0.6fr 0.8fr 0.9fr 1.4fr',
                      jobCostingEnabled ? ' 1.2fr' : '',
                      classTrackingEnabled ? ' 1fr' : '',
                      ' 24px',
                    ].join(''),
                      borderBottom: i < lineItems.length - 1 ? '0.5px solid var(--color-border-tertiary)' : 'none',
                      padding: '4px 8px',
                      background: item.is_tax_line ? '#FFFBEB' : 'white',
                    }}
                  >
                    <InlineInput initialValue={item.description ?? ''} onSave={v => updateLineItem(item.line_id, { description: v || null })} placeholder="Description" />
                    <InlineInput initialValue={item.quantity != null ? String(item.quantity) : ''} onSave={v => updateLineItem(item.line_id, { quantity: v ? parseFloat(v) : null })} align="right" placeholder="—" />
                    <InlineInput initialValue={item.unit_cost != null ? String(item.unit_cost) : ''} onSave={v => updateLineItem(item.line_id, { unit_cost: v ? parseFloat(v) : null })} align="right" placeholder="—" />
                    <InlineInput initialValue={item.extended_cost != null ? String(item.extended_cost) : ''} onSave={v => updateLineItem(item.line_id, { extended_cost: v ? parseFloat(v) : null })} align="right" placeholder="—" />
                    <div>
                      <InlineSelect
                        initialValue={item.gl_account_id ?? ''}
                        options={expenseAccounts.map(a => ({ value: a.qb_account_id, label: a.name ?? a.qb_account_id }))}
                        onSave={async (v) => {
                          await updateLineItem(item.line_id, { gl_account_id: v || null, gl_account_source: 'manual' })
                          if (v && item.description && bill.vendor_id) {
                            const account = expenseAccounts.find(a => a.qb_account_id === v)
                            setRememberPrompt({
                              lineId: item.line_id,
                              description: item.description,
                              glAccountId: v,
                              accountName: account?.name ?? v,
                            })
                          }
                        }}
                        placeholder="GL account…"
                        emptyLabel="Connect QB"
                      />
                      {item.gl_account_source && (
                        <SourceBadge source={item.gl_account_source} />
                      )}
                    </div>
                    {jobCostingEnabled && (
                      <InlineSelect
                        initialValue={item.job_id ?? ''}
                        options={jobs.map(j => ({
                          value: j.qb_job_id,
                          label: [j.job_number, j.job_name, j.customer_name].filter(Boolean).join(' – '),
                        }))}
                        onSave={async (v) => {
                          await updateLineItem(item.line_id, { job_id: v || null })
                          if (v && lineItems.length > 1) {
                            const job = jobs.find(j => j.qb_job_id === v)
                            const label = [job?.job_number, job?.job_name, job?.customer_name].filter(Boolean).join(' – ') || v
                            setJobApplyPrompt({ jobId: v, jobLabel: label })
                          }
                        }}
                        placeholder="Job…"
                        emptyLabel="—"
                      />
                    )}
                    {classTrackingEnabled && (
                      <InlineSelect
                        initialValue={item.class_id ?? ''}
                        options={classes.map(c => ({ value: c.qb_class_id, label: c.name ?? c.qb_class_id }))}
                        onSave={async (v) => {
                          await updateLineItem(item.line_id, { class_id: v || null })
                          if (v && bill.vendor_id) {
                            const cls = classes.find(c => c.qb_class_id === v)
                            setClassRememberPrompt({ lineId: item.line_id, classId: v, className: cls?.name ?? v })
                          }
                        }}
                        placeholder="Class…"
                        emptyLabel="—"
                      />
                    )}
                    <button
                      onClick={() => handleDeleteLine(item.line_id)}
                      disabled={isPending}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)', padding: 0, fontSize: 14 }}
                      title="Remove line"
                    >
                      <i className="ti ti-x" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {/* Remember? prompt */}
            {rememberPrompt && bill.vendor_id && (
              <div
                className="flex items-center gap-3 mt-2 px-3 py-2"
                style={{ background: '#FFFBEB', border: '0.5px solid #FDE68A', borderRadius: 6 }}
              >
                <i className="ti ti-bulb" style={{ fontSize: 14, color: '#D97706' }} />
                <p style={{ fontSize: 12, color: '#92400E', flex: 1 }}>
                  Remember <strong>{rememberPrompt.accountName}</strong> for &ldquo;{rememberPrompt.description}&rdquo;?
                </p>
                <button
                  onClick={async () => {
                    await saveLineItemMapping(bill.vendor_id!, rememberPrompt.description, rememberPrompt.glAccountId)
                    setRememberPrompt(null)
                  }}
                  style={{ fontSize: 12, fontWeight: 500, color: '#1A3D2B', background: '#D1FAE5', border: 'none', borderRadius: 4, padding: '3px 10px', cursor: 'pointer' }}
                >
                  Yes
                </button>
                <button
                  onClick={() => setRememberPrompt(null)}
                  style={{ fontSize: 12, color: '#92400E', background: 'none', border: 'none', cursor: 'pointer', padding: '3px 6px' }}
                >
                  No
                </button>
              </div>
            )}

            {/* Class remember prompt */}
            {classRememberPrompt && bill.vendor_id && (
              <div
                className="flex items-center gap-3 mt-2 px-3 py-2"
                style={{ background: '#FFFBEB', border: '0.5px solid #FDE68A', borderRadius: 6 }}
              >
                <i className="ti ti-bulb" style={{ fontSize: 14, color: '#D97706' }} />
                <p style={{ fontSize: 12, color: '#92400E', flex: 1 }}>
                  Remember <strong>{classRememberPrompt.className}</strong> as the default class for this vendor?
                </p>
                <button
                  onClick={async () => {
                    await saveVendorClassDefault(bill.vendor_id!, classRememberPrompt.classId)
                    setClassRememberPrompt(null)
                  }}
                  style={{ fontSize: 12, fontWeight: 500, color: '#1A3D2B', background: '#D1FAE5', border: 'none', borderRadius: 4, padding: '3px 10px', cursor: 'pointer' }}
                >
                  Yes
                </button>
                <button
                  onClick={() => setClassRememberPrompt(null)}
                  style={{ fontSize: 12, color: '#92400E', background: 'none', border: 'none', cursor: 'pointer', padding: '3px 6px' }}
                >
                  No
                </button>
              </div>
            )}

            {/* Apply job to all lines prompt */}
            {jobApplyPrompt && lineItems.length > 1 && (
              <div
                className="flex items-center gap-3 mt-2 px-3 py-2"
                style={{ background: '#EEF2FF', border: '0.5px solid #C7D2FE', borderRadius: 6 }}
              >
                <i className="ti ti-briefcase" style={{ fontSize: 14, color: '#4338CA' }} />
                <p style={{ fontSize: 12, color: '#3730A3', flex: 1 }}>
                  Apply <strong>{jobApplyPrompt.jobLabel}</strong> to all {lineItems.length} lines?
                </p>
                <button
                  onClick={async () => {
                    for (const li of lineItems) {
                      await updateLineItem(li.line_id, { job_id: jobApplyPrompt.jobId })
                    }
                    setJobApplyPrompt(null)
                    router.refresh()
                  }}
                  style={{ fontSize: 12, fontWeight: 500, color: 'white', background: '#4338CA', border: 'none', borderRadius: 4, padding: '3px 10px', cursor: 'pointer' }}
                >
                  Yes, all {lineItems.length}
                </button>
                <button
                  onClick={() => setJobApplyPrompt(null)}
                  style={{ fontSize: 12, color: '#4338CA', background: 'none', border: 'none', cursor: 'pointer', padding: '3px 6px' }}
                >
                  No
                </button>
              </div>
            )}


            {!isPublished && (
              <button
                onClick={handleAddLine}
                disabled={isPending}
                style={{ marginTop: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#2DB87A', fontSize: 12, fontWeight: 500, padding: 0, display: 'flex', alignItems: 'center', gap: 4 }}
              >
                <i className="ti ti-plus" style={{ fontSize: 12 }} />
                Add line item
              </button>
            )}
          </Section>

          {/* Totals reconciliation bar */}
          <div
            className="flex items-center justify-between"
            style={{ padding: '8px 0', borderTop: '0.5px solid var(--color-border-tertiary)' }}
          >
            <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
              Invoice total: ${invoiceTotal.toFixed(2)}
            </span>
            <div className="flex items-center gap-2">
              <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                Line items: ${lineItemsSum.toFixed(2)}
              </span>
              {totalsMatch ? (
                <i className="ti ti-check" style={{ fontSize: 14, color: '#2DB87A' }} />
              ) : (
                <span style={{ fontSize: 11, color: '#DC2626' }}>
                  Δ ${Math.abs(lineItemsSum - invoiceTotal).toFixed(2)}
                </span>
              )}
            </div>
          </div>

          {/* PAYMENT */}
          <Section title="Payment">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>Mark as Paid</p>
                <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2, lineHeight: 1.5 }}>
                  When on, this bill will be published to QuickBooks already marked as paid — with a linked bill payment record. Use for vendors you pay by credit card on order.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleMarkAsPaidToggle(!markAsPaid)}
                style={{
                  width: 36, height: 20, borderRadius: 10, border: 'none',
                  background: markAsPaid ? '#2DB87A' : 'var(--color-border-secondary)',
                  cursor: 'pointer', position: 'relative', flexShrink: 0, marginTop: 2,
                  transition: 'background 0.2s',
                }}
              >
                <span style={{
                  position: 'absolute', top: 2, left: markAsPaid ? 18 : 2,
                  width: 16, height: 16, borderRadius: '50%', background: 'white',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
                  transition: 'left 0.2s',
                }} />
              </button>
            </div>

            {markAsPaid && (
              <div className="space-y-3">
                <Field label="Payment Account" helper="The bank or credit card account the payment is posted against in QuickBooks.">
                  <select
                    defaultValue={bill.payment_account_id ?? ''}
                    onChange={e => {
                      const v = e.target.value || null
                      updateBill(bill.bill_id, { payment_account_id: v })
                      if (v && bill.vendor_id) {
                        const acct = paymentAccounts.find(a => a.qb_account_id === v)
                        setPaymentAccountRemember({ accountId: v, accountName: acct?.name ?? v })
                      }
                    }}
                    style={selectStyle}
                  >
                    <option value="">— Select account —</option>
                    {paymentAccounts.map(a => <option key={a.qb_account_id} value={a.qb_account_id}>{a.name}</option>)}
                  </select>
                </Field>
                {paymentAccountRemember && bill.vendor_id && (
                  <div className="flex items-center gap-3 px-3 py-2 mt-1" style={{ background: '#FFFBEB', border: '0.5px solid #FDE68A', borderRadius: 6 }}>
                    <i className="ti ti-bulb" style={{ fontSize: 14, color: '#D97706' }} />
                    <p style={{ fontSize: 12, color: '#92400E', flex: 1 }}>
                      Remember <strong>{paymentAccountRemember.accountName}</strong> as the default payment account for this vendor?
                    </p>
                    <button
                      onClick={async () => {
                        await saveVendorPaymentDefaults(bill.vendor_id!, { default_payment_account_id: paymentAccountRemember.accountId })
                        setPaymentAccountRemember(null)
                      }}
                      style={{ fontSize: 12, fontWeight: 500, color: '#1A3D2B', background: '#D1FAE5', border: 'none', borderRadius: 4, padding: '3px 10px', cursor: 'pointer' }}
                    >Yes</button>
                    <button onClick={() => setPaymentAccountRemember(null)} style={{ fontSize: 12, color: '#92400E', background: 'none', border: 'none', cursor: 'pointer', padding: '3px 6px' }}>No</button>
                  </div>
                )}
                <Field label="Payment Method" helper="Sets the payment type on the QB bill payment record.">
                  <select
                    defaultValue={bill.payment_method ?? ''}
                    onChange={e => {
                      const v = e.target.value || null
                      updateBill(bill.bill_id, { payment_method: v })
                      if (v && bill.vendor_id) {
                        const labels: Record<string, string> = { check: 'Check', ach: 'ACH', credit_card: 'Credit Card', other: 'Other' }
                        setPaymentMethodRemember({ method: v, methodLabel: labels[v] ?? v })
                      }
                    }}
                    style={selectStyle}
                  >
                    <option value="">— Select —</option>
                    <option value="check">Check</option>
                    <option value="ach">ACH</option>
                    <option value="credit_card">Credit Card</option>
                    <option value="other">Other</option>
                  </select>
                </Field>
                {paymentMethodRemember && bill.vendor_id && (
                  <div className="flex items-center gap-3 px-3 py-2 mt-1" style={{ background: '#FFFBEB', border: '0.5px solid #FDE68A', borderRadius: 6 }}>
                    <i className="ti ti-bulb" style={{ fontSize: 14, color: '#D97706' }} />
                    <p style={{ fontSize: 12, color: '#92400E', flex: 1 }}>
                      Remember <strong>{paymentMethodRemember.methodLabel}</strong> as the default payment method for this vendor?
                    </p>
                    <button
                      onClick={async () => {
                        await saveVendorPaymentDefaults(bill.vendor_id!, { default_payment_method: paymentMethodRemember.method })
                        setPaymentMethodRemember(null)
                      }}
                      style={{ fontSize: 12, fontWeight: 500, color: '#1A3D2B', background: '#D1FAE5', border: 'none', borderRadius: 4, padding: '3px 10px', cursor: 'pointer' }}
                    >Yes</button>
                    <button onClick={() => setPaymentMethodRemember(null)} style={{ fontSize: 12, color: '#92400E', background: 'none', border: 'none', cursor: 'pointer', padding: '3px 6px' }}>No</button>
                  </div>
                )}
                <Field label="Payment Date" helper="Defaults to invoice date. Editable.">
                  <input
                    type="date"
                    defaultValue={bill.payment_date ?? bill.invoice_date ?? ''}
                    onChange={e => updateBill(bill.bill_id, { payment_date: e.target.value || null })}
                    style={selectStyle}
                  />
                </Field>
                <Field label="Check / Reference Number" helper="Optional. Recorded on the QB bill payment record.">
                  <input
                    type="text"
                    defaultValue={bill.payment_ref_number ?? ''}
                    onBlur={e => updateBill(bill.bill_id, { payment_ref_number: e.target.value || null })}
                    placeholder="e.g. 1234 or ACH-8291"
                    style={selectStyle}
                  />
                </Field>
              </div>
            )}
          </Section>
        </div>
      </div>

      {/* Sticky publish area */}
      <div
        className="flex-none flex items-center justify-between"
        style={{
          padding: '12px 16px',
          borderTop: '0.5px solid var(--color-border-tertiary)',
          background: 'white',
        }}
      >
        {/* Left: delete + reprocess */}
        <div className="flex items-center gap-2">
          {!isPublished && (
            <button
              onClick={handleDelete}
              disabled={isPending}
              style={{
                background: 'white', color: '#991B1B',
                border: '0.5px solid #FCA5A5',
                borderRadius: 6, padding: '7px 12px',
                fontSize: 12, cursor: 'pointer',
              }}
            >
              Delete
            </button>
          )}
          {canReprocess && (
            <button
              onClick={() => setShowReprocessModal(true)}
              disabled={isPending}
              title="Re-run OCR or re-apply vendor defaults. No credit charge."
              style={{
                background: 'white', color: 'var(--color-text-secondary)',
                border: '0.5px solid var(--color-border-secondary)',
                borderRadius: 6, padding: '7px 12px',
                fontSize: 12, cursor: 'pointer',
                opacity: isPending ? 0.6 : 1,
              }}
            >
              {isPending ? 'Reprocessing…' : 'Reprocess (free)'}
            </button>
          )}
        </div>

        {/* Right: status actions */}
        <div className="flex items-center gap-2">
          {publishError && (
            <span style={{ fontSize: 11, color: '#991B1B' }}>{publishError}</span>
          )}
          {canMarkReady && (
            <button
              onClick={handleMarkReady}
              disabled={isPending}
              style={{
                background: 'white', color: 'var(--color-text-primary)',
                border: '0.5px solid var(--color-border-secondary)',
                borderRadius: 6, padding: '7px 16px',
                fontSize: 13, cursor: 'pointer',
                opacity: isPending ? 0.6 : 1,
              }}
            >
              {isPending ? 'Saving…' : 'Mark as Ready'}
            </button>
          )}
          {canPublish && (
            <button
              onClick={handlePublish}
              disabled={isPending}
              style={{
                background: '#2DB87A', color: 'white',
                borderRadius: 6, padding: '7px 16px',
                fontSize: 13, fontWeight: 500,
                border: 'none', cursor: 'pointer',
                opacity: isPending ? 0.6 : 1,
              }}
            >
              {isPending ? 'Publishing…' : localStatus === 'sync_error' ? 'Retry Push to QB' : 'Publish to QuickBooks'}
            </button>
          )}
        </div>
      </div>
    </div>
  )

  const handleDownload = async () => {
    if (!pdfSignedUrl) return
    try {
      const res = await fetch(pdfSignedUrl)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const vendor = (bill.vendor_name_raw ?? 'invoice').replace(/[^a-z0-9]/gi, '_')
      const inv    = (bill.invoice_number ?? bill.bill_id).replace(/[^a-z0-9]/gi, '_')
      a.download = `${vendor}_${inv}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch { /* signed URL may have expired — user can refresh */ }
  }

  const pdfPanel = (
    <div
      className="flex-1 overflow-hidden flex flex-col"
      style={{ background: 'var(--color-background-secondary)', order: swapped ? 0 : 2 }}
    >
      {pdfSignedUrl && (
        <div
          className="flex-none flex justify-end"
          style={{
            padding: '6px 10px',
            borderBottom: '0.5px solid var(--color-border-tertiary)',
            background: 'white',
          }}
        >
          <button
            onClick={handleDownload}
            title="Download PDF"
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: 'white', border: '0.5px solid var(--color-border-secondary)',
              borderRadius: 6, padding: '4px 10px',
              fontSize: 12, color: 'var(--color-text-secondary)',
              cursor: 'pointer',
            }}
          >
            <i className="ti ti-download" style={{ fontSize: 13 }} />
            Download
          </button>
        </div>
      )}
      <div className="flex-1 overflow-hidden">
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

  const reprocessCount = bill.reprocess_count ?? 0
  const nextTier = reprocessCount === 0 ? 2 : 3
  const tierLabel = nextTier === 2
    ? 'Tier 2 — Claude Haiku (enhanced text extraction)'
    : 'Tier 3 — Claude Opus (vision / scanned document)'

  const dragHandle = (
    <div
      onMouseDown={handleDragStart}
      style={{
        width: 5, flexShrink: 0, cursor: 'col-resize',
        background: 'var(--color-border-tertiary)',
        order: 1,
        transition: 'background 0.15s',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-border-secondary)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'var(--color-border-tertiary)')}
    />
  )

  return (
    <div className="flex" style={{ height: '100%' }}>
      {formPanel}
      {dragHandle}
      {pdfPanel}

      {showReprocessModal && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            background: 'rgba(0,0,0,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onClick={e => { if (e.target === e.currentTarget) { setShowReprocessModal(false); setReprocessComment('') } }}
        >
          <div style={{
            background: 'white', borderRadius: 10,
            width: 440, padding: '24px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
          }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 4 }}>
              Reprocess Invoice
            </h2>
            <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 16, lineHeight: 1.5 }}>
              This will re-run extraction and re-apply your vendor rules and GL mappings. No credit charge.
            </p>

            <div
              style={{
                background: '#EBF5EF', border: '0.5px solid #6EE7B7',
                borderRadius: 6, padding: '8px 12px', marginBottom: 16,
                fontSize: 12, color: '#1A3D2B',
              }}
            >
              <strong>Processing tier:</strong> {tierLabel}
              {reprocessCount > 0 && (
                <span style={{ color: '#5A8C6A', marginLeft: 6 }}>
                  (reprocess #{reprocessCount + 1})
                </span>
              )}
            </div>

            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 6 }}>
              What was wrong? <span style={{ fontWeight: 400, color: 'var(--color-text-tertiary)' }}>(optional)</span>
            </label>
            <textarea
              value={reprocessComment}
              onChange={e => setReprocessComment(e.target.value)}
              placeholder="e.g. Wrong vendor matched, invoice total is $1,234.56 not $123.45, line items are missing…"
              rows={4}
              style={{
                width: '100%', border: '0.5px solid var(--color-border-secondary)',
                borderRadius: 6, padding: '8px 10px',
                fontSize: 13, color: 'var(--color-text-primary)',
                resize: 'vertical', outline: 'none',
                fontFamily: 'inherit', lineHeight: 1.5,
                boxSizing: 'border-box',
              }}
            />
            <p style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 4 }}>
              Your note is passed to the AI to help it read the invoice correctly.
            </p>

            <div className="flex items-center justify-end gap-2" style={{ marginTop: 20 }}>
              <button
                onClick={() => { setShowReprocessModal(false); setReprocessComment('') }}
                style={{
                  background: 'white', color: 'var(--color-text-secondary)',
                  border: '0.5px solid var(--color-border-secondary)',
                  borderRadius: 6, padding: '7px 16px',
                  fontSize: 13, cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleReprocessSubmit(reprocessComment)}
                style={{
                  background: '#2DB87A', color: 'white',
                  border: 'none', borderRadius: 6, padding: '7px 16px',
                  fontSize: 13, fontWeight: 500, cursor: 'pointer',
                }}
              >
                Reprocess
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Section heading ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p style={{
        fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em',
        color: 'var(--color-text-secondary)',
        paddingTop: 12, marginBottom: 10,
        borderTop: '0.5px solid var(--color-border-tertiary)',
      }}>
        {title}
      </p>
      {children}
    </div>
  )
}

function Field({ label, helper, children }: { label: string; helper: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>
        {label}
      </label>
      {children}
      <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 3, lineHeight: 1.5 }}>{helper}</p>
    </div>
  )
}

// ── AutoSave input ────────────────────────────────────────────────────────────

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

function AutoSaveInput({
  initialValue, onSave, type = 'text', placeholder, align,
}: {
  initialValue: string
  onSave: (v: string) => Promise<void>
  type?: 'text' | 'date' | 'number'
  placeholder?: string
  align?: 'right'
}) {
  const [value, setValue] = useState(initialValue)
  const [state, setState] = useState<SaveState>('idle')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleBlur = async () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setState('saving')
    try {
      await onSave(value)
      setState('saved')
      timerRef.current = setTimeout(() => setState('idle'), 2000)
    } catch {
      setState('error')
    }
  }

  const borderColor = state === 'saving' ? '#F59E0B' : state === 'saved' ? '#2DB87A' : state === 'error' ? '#DC2626' : undefined

  return (
    <input
      type={type}
      step={type === 'number' ? '0.01' : undefined}
      value={value}
      onChange={e => setValue(e.target.value)}
      onBlur={handleBlur}
      placeholder={placeholder}
      style={{
        width: '100%', height: 36,
        border: `0.5px solid ${borderColor ?? 'var(--color-border-secondary)'}`,
        borderRadius: 6, padding: '0 10px',
        fontSize: 13, color: 'var(--color-text-primary)',
        textAlign: align === 'right' ? 'right' : 'left',
        outline: 'none',
        background: 'white',
      }}
    />
  )
}

// ── Inline table inputs ────────────────────────────────────────────────────────

function InlineInput({ initialValue, onSave, placeholder, align }: { initialValue: string; onSave: (v: string) => Promise<void>; placeholder?: string; align?: 'right' }) {
  const [value, setValue] = useState(initialValue)

  const handleBlur = async () => {
    try { await onSave(value) } catch { /* silent */ }
  }

  return (
    <input
      value={value}
      onChange={e => setValue(e.target.value)}
      onBlur={handleBlur}
      placeholder={placeholder}
      style={{
        width: '100%', border: '0.5px solid transparent', borderRadius: 4,
        padding: '3px 4px', fontSize: 12, background: 'transparent',
        color: 'var(--color-text-primary)',
        textAlign: align === 'right' ? 'right' : 'left',
      }}
    />
  )
}

function InlineSelect({ initialValue, options, onSave, placeholder, emptyLabel }: {
  initialValue: string
  options: { value: string; label: string }[]
  onSave: (v: string) => Promise<void>
  placeholder: string
  emptyLabel: string
}) {
  const [value, setValue] = useState(initialValue)

  useEffect(() => { setValue(initialValue) }, [initialValue])

  if (options.length === 0) {
    return <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)', fontStyle: 'italic', padding: '0 4px' }}>{emptyLabel}</span>
  }

  const handleChange = async (newValue: string) => {
    setValue(newValue)
    try { await onSave(newValue) } catch { setValue(initialValue) }
  }

  return (
    <select
      value={value}
      onChange={e => handleChange(e.target.value)}
      style={{
        width: '100%', border: '0.5px solid transparent', borderRadius: 4,
        padding: '3px 4px', fontSize: 12, background: 'transparent',
        color: 'var(--color-text-primary)',
      }}
    >
      <option value="">{placeholder}</option>
      {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
    </select>
  )
}

const selectStyle: React.CSSProperties = {
  width: '100%', height: 36,
  border: '0.5px solid var(--color-border-secondary)',
  borderRadius: 6, padding: '0 10px',
  fontSize: 13, color: 'var(--color-text-primary)',
  background: 'white',
}

// ── Source badge ─────────────────────────────────────────────────────────────

const SOURCE_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  qb_default:         { label: 'QB',       bg: '#DBEAFE', color: '#1E40AF' },
  billflow_override:  { label: 'Purchasomatic', bg: '#EBF5EF', color: '#1A3D2B' },
  rule:               { label: 'Rule',     bg: '#EDE9FE', color: '#5B21B6' },
  manual:             { label: 'Manual',   bg: '#FEF3C7', color: '#92400E' },
  mapping:            { label: 'Learned',  bg: '#D1FAE5', color: '#065F46' },
}

function SourceBadge({ source }: { source: string }) {
  const cfg = SOURCE_BADGE[source]
  if (!cfg) return null
  return (
    <span
      style={{
        display: 'inline-block', marginTop: 2,
        background: cfg.bg, color: cfg.color,
        borderRadius: 3, padding: '1px 5px',
        fontSize: 9, fontWeight: 600, letterSpacing: '0.03em',
        textTransform: 'uppercase',
      }}
    >
      {cfg.label}
    </span>
  )
}

// ── Bill type toggle ──────────────────────────────────────────────────────────

function BillTypeToggle({
  value, onChange, disabled,
}: {
  value: string
  onChange: (v: string) => void
  disabled: boolean
}) {
  const options = [
    { value: 'bill', label: 'Invoice / Bill' },
    { value: 'credit_note', label: 'Credit Note' },
  ]
  return (
    <div className="flex items-center gap-1" style={{ display: 'flex', gap: 4 }}>
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          disabled={disabled}
          onClick={() => !disabled && onChange(opt.value)}
          style={{
            flex: 1,
            height: 32,
            border: `0.5px solid ${value === opt.value ? '#2DB87A' : 'var(--color-border-secondary)'}`,
            borderRadius: 6,
            background: value === opt.value ? '#EBF5EF' : 'white',
            color: value === opt.value ? '#1A3D2B' : 'var(--color-text-secondary)',
            fontSize: 12,
            fontWeight: value === opt.value ? 500 : 400,
            cursor: disabled ? 'default' : 'pointer',
            transition: 'all 0.15s',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
