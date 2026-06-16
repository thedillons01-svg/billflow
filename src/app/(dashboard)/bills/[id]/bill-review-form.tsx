'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useRef, useTransition, useEffect, useCallback, createContext, useContext } from 'react'
import { useDirty, useGuardedNavigate } from '@/components/unsaved-guard'
import { formatDateOnly } from '@/lib/utils/date'
import { updateBill, updateLineItem, setBillStatus, softDeleteBill, addLineItem, deleteLineItem, saveLineItemMapping, enableVendorAutoPublish, saveVendorPaymentDefaults, saveVendorClassDefault, saveVendorGlDefault, getVendorBillHistory, createVendorFromBill, addVendorToQB, moveBillToPO } from '../actions'
import { reopenJob, createJob } from '../../jobs/actions'

const FieldTipsContext = createContext(true)

// Omit job_number from the label when job_name already starts with it.
// Prevents "Metro Property Group – 1052 – 1052 — Riverside Apartments" when
// the user names the job "1052 — Riverside Apartments".
function buildJobLabel(j: { customer_name?: string | null; job_number?: string | null; job_name?: string | null }, fallback = ''): string {
  const numInName = !!(j.job_number && j.job_name && new RegExp(`^${j.job_number}\\b`).test(j.job_name))
  return [j.customer_name, numInName ? null : j.job_number, j.job_name].filter(Boolean).join(' – ') || fallback
}

type Account = { id: string; qb_account_id: string; name: string | null; account_type: string | null }
type Job = { id: string; qb_job_id: string; job_number: string | null; job_name: string | null; customer_name: string | null; parent_id?: string | null; is_customer?: boolean; status?: string }
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
  job_name_extracted: string | null
  customer_name_extracted: string | null
  matched_customer_qb_id: string | null
}

const STATUS_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  draft:                 { bg: '#FEF3C7', color: '#92400E', label: 'Needs Review' },
  ready:                 { bg: '#D1FAE5', color: '#065F46', label: 'Ready' },
  sync_error:            { bg: '#FEE2E2', color: '#991B1B', label: 'Sync Error' },
  ocr_error:             { bg: '#FEE2E2', color: '#991B1B', label: 'OCR Error' },
  fingerprint_duplicate: { bg: '#FEF3C7', color: '#92400E', label: 'Duplicate' },
  pending_job_match:     { bg: '#EDE9FE', color: '#5B21B6', label: 'Pending Job Match' },
  publishing:            { bg: '#DBEAFE', color: '#1E40AF', label: 'Publishing' },
  published:             { bg: '#D1FAE5', color: '#065F46', label: 'Published' },
}

export function BillReviewForm({
  bill,
  lineItems: initialLineItems,
  accounts,
  jobs,
  closedJobs = [],
  classes,
  vendorPromo,
  vendors = [],
  customers = [],
  jobCostingEnabled = false,
  classTrackingEnabled = false,
  showFieldTips = true,
  qbType = 'qbo',
  pdfSignedUrl = null,
}: {
  bill: Bill
  lineItems: LineItem[]
  accounts: Account[]
  jobs: Job[]
  closedJobs?: Job[]
  classes: QBClass[]
  vendorPromo?: { vendorId: string; invoicesProcessed: number } | null
  vendors?: Vendor[]
  customers?: Job[]
  jobCostingEnabled?: boolean
  classTrackingEnabled?: boolean
  showFieldTips?: boolean
  qbType?: 'qbo' | 'qbd'
  pdfSignedUrl?: string | null
}) {
  const router = useRouter()
  const navigate = useGuardedNavigate()
  const { setDirty, registerSaveFn } = useDirty()
  const [stablePdfUrl] = useState(pdfSignedUrl)
  const [liveJobs, setLiveJobs] = useState<Job[]>(jobs)
  const [liveClosedJobs, setLiveClosedJobs] = useState<Job[]>(closedJobs)
  const [liveCustomers, setLiveCustomers] = useState<Job[]>(customers)

  // Build select options. Sub-customers are indented under their parent customer name.
  const buildJobOptions = (jobList: Job[]) => {
    const hasCustomers = jobList.some(j => j.is_customer)
    return jobList.map(j => {
      const label = hasCustomers && !j.is_customer
        ? `  ${buildJobLabel(j)}`
        : j.is_customer
        ? `${j.job_name ?? j.customer_name ?? ''}`
        : buildJobLabel(j)
      return { value: j.qb_job_id, label }
    })
  }

  const handleReopenAndSelect = async (jobId: string, onSelect: (id: string) => Promise<void>) => {
    await reopenJob(jobId)
    setLiveClosedJobs(prev => prev.filter(j => j.qb_job_id !== jobId))
    const reopened = liveClosedJobs.find(j => j.qb_job_id === jobId)
    if (reopened) setLiveJobs(prev => [...prev, reopened])
    await onSelect(jobId)
  }
  const [localStatus, setLocalStatus] = useState(bill.status)
  const [localVendorId, setLocalVendorId] = useState(bill.vendor_id ?? '')
  const [swapped, setSwapped] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [isReprocessing, setIsReprocessing] = useState(false)
  const [isMovingToPO, setIsMovingToPO] = useState(false)
  const reprocessCount = bill.reprocess_count ?? 0
  const nextTier = reprocessCount === 0 ? 2 : 3
  const tierLabel = nextTier === 2
    ? 'Tier 2 — Claude Haiku (enhanced text extraction)'
    : 'Tier 3 — Claude Opus (vision / scanned document)'
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
    jobId: string | null; jobLabel: string; matchedOthers?: number
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
  const [localVendorQbLinked, setLocalVendorQbLinked] = useState(bill.vendor_qb_linked)
  const [qbAddError, setQbAddError] = useState<string | null>(null)
  const [showJobCreate, setShowJobCreate] = useState(false)
  const [newJobName, setNewJobName] = useState('')
  const [newJobCustomerId, setNewJobCustomerId] = useState('')
  const [jobCreateError, setJobCreateError] = useState<string | null>(null)
  const [showCustomerCreate, setShowCustomerCreate] = useState(false)
  const [newCustomerName, setNewCustomerName] = useState('')
  const [localMatchedCustomerId, setLocalMatchedCustomerId] = useState<string | null>(() => {
    if (bill.matched_customer_qb_id) return bill.matched_customer_qb_id as string
    if (!bill.customer_name_extracted) return null
    const lower = (bill.customer_name_extracted as string).toLowerCase()
    const match = customers.find(c => {
      const cn = (c.job_name ?? '').toLowerCase()
      return cn === lower || lower.includes(cn) || cn.includes(lower)
    })
    return match?.qb_job_id ?? null
  })
  const [customerCreateError, setCustomerCreateError] = useState<string | null>(null)

  // Invoice history popover
  const [showHistory, setShowHistory] = useState(false)
  const [historyBills, setHistoryBills] = useState<Array<{
    bill_id: string; invoice_number: string | null; invoice_date: string | null; total: number | null; status: string
  }> | null>(null)
  const historyRef = useRef<HTMLDivElement>(null)
  const formRef = useRef<HTMLDivElement>(null)
  const [formWidth, setFormWidth] = useState(560)
  const [isDragging, setIsDragging] = useState(false)

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = formRef.current?.offsetWidth ?? formWidth

    setIsDragging(true)

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
      setIsDragging(false)
      const delta = swapped ? startX - ev.clientX : ev.clientX - startX
      setFormWidth(Math.min(900, Math.max(320, startWidth + delta)))
    }

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [swapped, formWidth])

  // Fetch live jobs from QB on mount — replaces stale cache with current QB data
  useEffect(() => {
    fetch('/api/quickbooks/jobs?includeClosed=true')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.jobs) {
          const active = (data.jobs as Job[]).filter(j => j.status !== 'closed')
          const closed = (data.jobs as Job[]).filter(j => j.status === 'closed')
          setLiveJobs(active)
          setLiveClosedJobs(closed)
        }
      })
      .catch(() => {})
  }, [])

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
        setDirty(false)
        router.refresh()
      }
    })
  }

  const [savedFeedback, setSavedFeedback] = useState(false)

  // saveFnRef always closes over latest local state — registered once so the
  // unsaved-changes dialog can save without requiring the user to cancel first.
  const saveFnRef = useRef<() => Promise<void>>(async () => {})
  useEffect(() => {
    registerSaveFn(() => saveFnRef.current())
    return () => registerSaveFn(null)
  }, [registerSaveFn])

  saveFnRef.current = async () => {
    await updateBill(bill.bill_id, {
      vendor_id: localVendorId || null,
      bill_type: billType,
      mark_as_paid: markAsPaid,
    })
    setDirty(false)
    setSavedFeedback(true)
    setTimeout(() => setSavedFeedback(false), 1500)
  }

  const handleSave = () => {
    startTransition(() => saveFnRef.current())
  }

  const handleCancel = () => navigate('/bills')

  const handleDelete = () => {
    startTransition(async () => {
      await softDeleteBill(bill.bill_id)
      router.push('/bills')
    })
  }

  const handleMoveToPO = () => {
    if (!confirm('Move this to Purchase Orders? It will be removed from Bills and re-processed as a PO. No additional credit will be charged.')) return
    setIsMovingToPO(true)
    startTransition(async () => {
      try {
        const { poId } = await moveBillToPO(bill.bill_id)
        router.push(`/purchase-orders/${poId}`)
      } catch (err) {
        setIsMovingToPO(false)
        alert(err instanceof Error ? err.message : 'Failed to move to Purchase Orders')
      }
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

  const handleReprocessSubmit = async (comment: string) => {
    setShowReprocessModal(false)
    setReprocessComment('')
    setIsReprocessing(true)
    try {
      const res = await fetch(`/api/bills/${bill.bill_id}/reprocess`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: comment.trim() || undefined }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.bill?.status !== undefined)     setLocalStatus(data.bill.status)
        if (data.bill?.vendor_id !== undefined)  setLocalVendorId(data.bill.vendor_id ?? '')
        if (Array.isArray(data.lineItems))       setLineItems(data.lineItems)
        router.refresh()
      } else {
        const json = await res.json().catch(() => ({}))
        setPublishError(json.error ?? 'Reprocess failed')
      }
    } finally {
      setIsReprocessing(false)
    }
  }

  const badge = STATUS_BADGE[localStatus] ?? STATUS_BADGE.draft
  const canPublish = ['ready', 'sync_error', 'fingerprint_duplicate'].includes(localStatus)
  const isPublished = localStatus === 'published'
  const canReprocess = !isPublished

  // Compute what's blocking ready status from local state
  const missingGlCount = lineItems.filter(li => !li.gl_account_id).length
  const localLineSum = lineItems.reduce((s, li) => s + (li.extended_cost ?? 0), 0)
  const totalsMismatch = bill.total != null && lineItems.length > 0 && Math.abs(localLineSum - bill.total) > 0.01
  const needsReviewItems: string[] = [
    ...(!localVendorId ? ['Assign a vendor'] : []),
    ...(missingGlCount > 0 ? [`Set GL account on ${missingGlCount} line item${missingGlCount === 1 ? '' : 's'}`] : []),
    ...(totalsMismatch ? [`Line items total ($${localLineSum.toFixed(2)}) doesn't match invoice total ($${bill.total!.toFixed(2)})`] : []),
  ]

  // Auto-promote local status badge when all issues are resolved
  useEffect(() => {
    if (localStatus !== 'draft') return
    if (needsReviewItems.length === 0) setLocalStatus('ready')
  }, [needsReviewItems.length, localStatus])

  const [localShowTips, setLocalShowTips] = useState(() => {
    if (typeof window === 'undefined') return showFieldTips
    const stored = localStorage.getItem('purchasomatic:showFieldTips')
    return stored === null ? showFieldTips : stored === 'true'
  })

  const formPanel = (
    <FieldTipsContext.Provider value={localShowTips}>
      <div
        ref={formRef}
      style={{
        position: 'relative',
        width: formWidth, flexShrink: 0,
        display: 'flex', flexDirection: 'column',
        height: '100%', minHeight: 0, overflow: 'hidden',
        background: 'white',
        order: swapped ? 2 : 0,
      }}
    >
      {isReprocessing && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 20,
          background: 'rgba(255,255,255,0.93)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 14,
        }}>
          <i className="ti ti-loader-2" style={{ fontSize: 36, color: '#2DB87A', animation: 'spin 1s linear infinite' }} />
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: 6 }}>
              Reprocessing invoice…
            </p>
            <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
              Running {nextTier === 2 ? 'Tier 2 — Claude Haiku' : 'Tier 3 — Claude Vision'}<br />
              This usually takes 20–30 seconds
            </p>
          </div>
        </div>
      )}
      {/* Fixed header */}
      <div
        className="flex-none px-5 py-3"
        style={{ borderBottom: '0.5px solid var(--color-border-tertiary)' }}
      >
        <button
          onClick={() => navigate('/bills')}
          className="flex items-center gap-1 mb-2"
          style={{ fontSize: 12, color: 'var(--color-text-secondary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          <i className="ti ti-arrow-left" style={{ fontSize: 12 }} />
          Back to Bills
        </button>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 min-w-0">
            <h1 style={{ fontSize: 15, fontWeight: 500, color: 'var(--color-text-primary)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {bill.vendor_name_display ?? bill.vendor_name_raw ?? 'Unknown Vendor'}
            </h1>
            {bill.vendor_id && (
              <a
                href={`/vendors/${bill.vendor_id}?from=/bills/${bill.bill_id}`}
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
            <label className="flex items-center gap-1.5" style={{ cursor: 'pointer', flexShrink: 0 }}>
              <input
                type="checkbox"
                checked={localShowTips}
                onChange={e => {
                  setLocalShowTips(e.target.checked)
                  localStorage.setItem('purchasomatic:showFieldTips', String(e.target.checked))
                }}
                style={{ width: 12, height: 12, accentColor: '#2DB87A', cursor: 'pointer' }}
              />
              <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>Tips</span>
            </label>

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
                            {formatDateOnly(b.invoice_date)}
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
                  onChange={() => { if (!isPublished) { setBillType(opt.value); setDirty(true) } }}
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
        <div className="px-5 py-3 space-y-3">
          {/* Needs Review — what's missing */}
          {needsReviewItems.length > 0 && !isPublished && (
            <div style={{ background: '#FFFBEB', border: '0.5px solid #FDE68A', borderRadius: 6, padding: '10px 12px' }}>
              <div className="flex items-start gap-2">
                <i className="ti ti-alert-triangle" style={{ fontSize: 14, color: '#D97706', marginTop: 1, flexShrink: 0 }} />
                <div>
                  <p style={{ fontSize: 12, fontWeight: 500, color: '#92400E', marginBottom: 4 }}>
                    This bill can&apos;t be published yet:
                  </p>
                  <ul style={{ margin: 0, paddingLeft: 16 }}>
                    {needsReviewItems.map((item, i) => (
                      <li key={i} style={{ fontSize: 12, color: '#92400E', lineHeight: 1.7 }}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
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
                      fontSize: 12, color: '#64748B',
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
          {(() => {
            const hasNoJob = lineItems.every(li => !li.job_id)
            const showFindMatch = hasNoJob && !isPublished
            if (!showFindMatch) return null
            const isPending_ = localStatus === 'pending_job_match'
            return (
              <div
                className="flex items-center justify-between"
                style={{ background: '#EDE9FE', border: '0.5px solid #C4B5FD', borderRadius: 6, padding: '10px 12px' }}
              >
                <div>
                  <p style={{ fontSize: 12, fontWeight: 500, color: '#5B21B6' }}>
                    {isPending_ ? 'Waiting for job match' : 'No job assigned'}
                  </p>
                  <p style={{ fontSize: 11, color: '#6D28D9', marginTop: 2 }}>
                    {isPending_
                      ? 'Retry checks every 2 hours during business hours. Use Find Match to retry now.'
                      : bill.vendor_po_reference
                        ? 'Click Find Match to search for a matching job in QuickBooks.'
                        : 'No reference number on this bill — add one to enable Find Match, or assign a job manually below.'}
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
            )
          })()}
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
                disabled={isPending || isReprocessing}
                style={{
                  background: '#DC2626', color: 'white',
                  border: 'none', borderRadius: 6, padding: '5px 12px',
                  fontSize: 12, fontWeight: 500, flexShrink: 0,
                  cursor: isPending || isReprocessing ? 'not-allowed' : 'pointer',
                  opacity: isPending || isReprocessing ? 0.6 : 1,
                }}
              >
                {isReprocessing ? 'Reprocessing…' : 'Reprocess'}
              </button>
            </div>
          )}

          {/* INVOICE DETAILS */}
          <div className="grid grid-cols-2 gap-2">
              <Field label="Vendor" helper="The vendor this invoice is matched to. Change if the OCR matched the wrong vendor.">
                  <select
                    value={localVendorId}
                    onChange={e => {
                      setLocalVendorId(e.target.value)
                      setDirty(true)
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
                  {localVendorId !== '' && localVendorQbLinked === false && (
                    <>
                      <p style={{ marginTop: 5, fontSize: 11, color: '#92400E', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <i className="ti ti-alert-triangle" style={{ fontSize: 12 }} />
                        Vendor has no QuickBooks link — bills cannot be published.
                      </p>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => {
                          setQbAddError(null)
                          startTransition(async () => {
                            const result = await addVendorToQB(localVendorId, bill.company_id)
                            if (result.error) {
                              setQbAddError(result.error)
                            } else {
                              setLocalVendorQbLinked(true)
                              router.refresh()
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
                        {isPending ? 'Adding to QuickBooks…' : 'Add to QuickBooks'}
                      </button>
                      {qbAddError && (
                        <p style={{ marginTop: 4, fontSize: 11, color: '#991B1B', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <i className="ti ti-circle-x" style={{ fontSize: 12 }} />
                          {qbAddError}
                        </p>
                      )}
                    </>
                  )}
                  {localVendorId === '' && bill.vendor_name_raw && (
                    <>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => {
                          setVendorCreateError(null)
                          startTransition(async () => {
                            const result = await createVendorFromBill(bill.bill_id, bill.company_id, bill.vendor_name_raw!)
                            if ('error' in result) {
                              setVendorCreateError(result.error)
                            } else {
                              setLocalVendorId(result.vendorId)
                              router.refresh()
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
                <AutoSaveInput type="number" currency initialValue={bill.total != null ? String(bill.total) : ''} onSave={v => updateBill(bill.bill_id, { total: v ? parseFloat(v) : null })} align="right" placeholder="0.00" />
              </Field>
              <Field
                label="Vendor PO / Reference"
                helper={qbType === 'qbd'
                  ? "The purchase order or reference number from the invoice. Used for job matching and copied to the QB Desktop Ref No. field."
                  : "The purchase order or reference number from the invoice. Used to match this bill to a QuickBooks job."}
              >
                <AutoSaveInput initialValue={bill.vendor_po_reference ?? ''} onSave={v => updateBill(bill.bill_id, { vendor_po_reference: v || null })} placeholder="e.g. PO-12345" />
              </Field>
              <Field
                label="Memo / Description"
                helper={qbType === 'qbd'
                  ? "Sent to the QB bill memo field. If left blank, the Vendor PO / Reference is used instead — useful since the Ref No. field in QB Desktop is limited to 21 characters."
                  : "Sent to the QB bill memo field. The matched job name is automatically appended when the bill is published."}
              >
                <AutoSaveInput initialValue={bill.description ?? ''} onSave={v => updateBill(bill.bill_id, { description: v || null })} placeholder="Memo on QB bill" />
              </Field>
              {lineItems.length > 0 && (
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
              )}
              {jobCostingEnabled && lineItems.length > 0 && (
                <div className="col-span-2">
                <Field label="Job (all lines)" helper="Sets the job for all line items at once. Individual line items can still be changed after.">

                    {/* Apply-to-all confirmation — top priority, shown first */}
                    {headerJobPending && (
                      <div className="flex items-center gap-2 mb-2" style={{
                        padding: '6px 10px',
                        background: headerJobPending.jobId ? '#EBF5EF' : '#FEF2F2',
                        border: `0.5px solid ${headerJobPending.jobId ? '#A7F3D0' : '#FECACA'}`,
                        borderRadius: 6,
                      }}>
                        <i className={`ti ${headerJobPending.jobId ? 'ti-corner-down-right' : 'ti-x'}`} style={{ fontSize: 12, color: headerJobPending.jobId ? '#059669' : '#DC2626', flexShrink: 0 }} />
                        <span style={{ fontSize: 12, color: headerJobPending.jobId ? '#065F46' : '#991B1B', flex: 1 }}>
                          {headerJobPending.jobId
                            ? <><>Apply <strong>{headerJobPending.jobLabel}</strong> to all {lineItems.length} lines?</>{headerJobPending.matchedOthers ? <> Also matched {headerJobPending.matchedOthers} other bill{headerJobPending.matchedOthers !== 1 ? 's' : ''} to this job.</> : null}</>
                            : <>Clear job from all {lineItems.filter(li => li.job_id).length} lines?</>}
                        </span>
                        <button
                          onClick={async () => {
                            const pending = headerJobPending
                            setHeaderJobPending(null)
                            const updated = lineItems.map(li => ({ ...li, job_id: pending.jobId ?? null }))
                            setLineItems(updated)
                            await Promise.all(updated.map(li => updateLineItem(li.line_id, { job_id: pending.jobId ?? null })))
                            router.refresh()
                          }}
                          style={{
                            fontSize: 12, fontWeight: 500, color: 'white',
                            background: headerJobPending.jobId ? '#059669' : '#DC2626',
                            border: 'none', borderRadius: 4, padding: '3px 10px', cursor: 'pointer', flexShrink: 0,
                          }}
                        >
                          {headerJobPending.jobId ? `Yes, all ${lineItems.length}` : `Clear all ${lineItems.filter(li => li.job_id).length}`}
                        </button>
                        <button onClick={() => setHeaderJobPending(null)} style={{ fontSize: 12, color: headerJobPending.jobId ? '#065F46' : '#991B1B', background: 'none', border: 'none', cursor: 'pointer', padding: '3px 6px' }}>No</button>
                      </div>
                    )}

                    {/* OCR extracted job/customer reference banner */}
                    {!headerJobPending && (bill.job_name_extracted || bill.customer_name_extracted) && lineItems.every(li => !li.job_id) && (
                      <div className="flex items-start gap-2 mb-2" style={{ background: '#FFFBEB', border: '0.5px solid #FDE68A', borderRadius: 6, padding: '8px 10px' }}>
                        <i className="ti ti-search" style={{ fontSize: 13, color: '#D97706', marginTop: 1, flexShrink: 0 }} />
                        <div>
                          <p style={{ fontSize: 12, color: '#92400E', fontWeight: 500 }}>
                            {localMatchedCustomerId
                              ? 'Customer matched — no job found yet'
                              : 'Job reference on invoice — no QuickBooks match found'}
                          </p>
                          <p style={{ fontSize: 11, color: '#92400E', marginTop: 2 }}>
                            {[bill.job_name_extracted, bill.customer_name_extracted].filter(Boolean).join(' / ')}
                          </p>
                          <p style={{ fontSize: 11, color: '#B45309', marginTop: 4 }}>
                            {localMatchedCustomerId
                              ? 'Tag lines to this customer directly, or select/create a job under them.'
                              : 'Select a matching job below, or create a new one.'}
                          </p>
                        </div>
                      </div>
                    )}

                    <InlineSelect
                      initialValue={
                        lineItems.every(li => li.job_id === lineItems[0].job_id)
                          ? (lineItems[0].job_id ?? '')
                          : ''
                      }
                      options={buildJobOptions(liveJobs)}
                      closedOptions={buildJobOptions(liveClosedJobs)}
                      onSave={async (v) => {
                        if (!v) {
                          // Clearing the job — offer to clear from all lines that have one
                          const linesWithJob = lineItems.filter(li => li.job_id)
                          if (linesWithJob.length > 1) {
                            setHeaderJobPending({ jobId: null, jobLabel: '' })
                          } else if (linesWithJob.length === 1) {
                            const updated = lineItems.map(li => ({ ...li, job_id: null }))
                            setLineItems(updated)
                            await updateLineItem(linesWithJob[0].line_id, { job_id: null })
                            router.refresh()
                          }
                          return
                        }
                        const job = liveJobs.find(j => j.qb_job_id === v)
                        const label = job ? buildJobLabel(job, v) : v
                        if (lineItems.length > 1) {
                          setHeaderJobPending({ jobId: v, jobLabel: label })
                        } else if (lineItems.length === 1) {
                          await updateLineItem(lineItems[0].line_id, { job_id: v })
                          router.refresh()
                        }
                      }}
                      onSaveClosed={async (v) => {
                        await handleReopenAndSelect(v, async (id) => {
                          const job = [...liveJobs, ...liveClosedJobs].find(j => j.qb_job_id === id)
                          const label = job ? buildJobLabel(job, id) : id
                          if (lineItems.length > 1) {
                            setHeaderJobPending({ jobId: id, jobLabel: label })
                          } else if (lineItems.length === 1) {
                            await updateLineItem(lineItems[0].line_id, { job_id: id })
                            router.refresh()
                          }
                        })
                      }}
                      placeholder={lineItems.every(li => li.job_id === lineItems[0].job_id) ? 'Job…' : 'Mixed — select to apply all'}
                      emptyLabel="—"
                    />

                    {/* Create customer / job forms — visible whenever any line is unassigned or a form is open */}
                    {(lineItems.some(li => !li.job_id) || showJobCreate || showCustomerCreate) && (
                      <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>

                        {/* Create new customer */}
                        {!showCustomerCreate && !showJobCreate && (
                          <button type="button"
                            onClick={() => { setShowCustomerCreate(true); setNewCustomerName(bill.customer_name_extracted ?? ''); setCustomerCreateError(null) }}
                            style={{ background: 'none', border: 'none', padding: 0, fontSize: 12, color: '#2DB87A', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, alignSelf: 'flex-start' }}
                          >
                            <i className="ti ti-plus" style={{ fontSize: 12 }} />
                            Create new customer in QuickBooks
                          </button>
                        )}
                        {showCustomerCreate && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 10px', background: 'var(--color-background-secondary)', borderRadius: 6, border: '0.5px solid var(--color-border-tertiary)' }}>
                            <p style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-text-secondary)', margin: 0 }}>New customer</p>
                            <div className="flex items-center gap-2">
                              <input type="text" value={newCustomerName} onChange={e => setNewCustomerName(e.target.value)} placeholder="Customer name" autoFocus
                                style={{ flex: 1, height: 28, border: '0.5px solid var(--color-border-secondary)', borderRadius: 5, padding: '0 8px', fontSize: 12 }}
                              />
                              <button type="button" disabled={!newCustomerName.trim() || isPending}
                                onClick={() => {
                                  setCustomerCreateError(null)
                                  startTransition(async () => {
                                    const trimmed = newCustomerName.trim()
                                    const existing = liveCustomers.find(c =>
                                      (c.job_name ?? '').toLowerCase() === trimmed.toLowerCase()
                                    )
                                    if (existing) {
                                      setNewJobCustomerId(existing.qb_job_id)
                                      setLocalMatchedCustomerId(existing.qb_job_id)
                                      await updateBill(bill.bill_id, { matched_customer_qb_id: existing.qb_job_id })
                                      setNewJobName(bill.job_name_extracted ?? bill.vendor_po_reference ?? '')
                                      setShowCustomerCreate(false)
                                      setNewCustomerName('')
                                      setShowJobCreate(true)
                                      return
                                    }
                                    const result = await createJob(bill.company_id, trimmed, undefined)
                                    if ('error' in result) {
                                      setCustomerCreateError(result.error)
                                    } else {
                                      const newCust: Job = { id: result.qbJobId, qb_job_id: result.qbJobId, job_number: result.jobNumber, job_name: result.jobName, customer_name: null, is_customer: true, status: 'active' }
                                      setLiveCustomers(prev => [...prev, newCust])
                                      setNewJobCustomerId(result.qbJobId)
                                      setLocalMatchedCustomerId(result.qbJobId)
                                      await updateBill(bill.bill_id, { matched_customer_qb_id: result.qbJobId })
                                      setNewJobName(bill.job_name_extracted ?? bill.vendor_po_reference ?? '')
                                      setShowCustomerCreate(false)
                                      setNewCustomerName('')
                                      setShowJobCreate(true)
                                    }
                                  })
                                }}
                                style={{ height: 28, padding: '0 12px', fontSize: 12, fontWeight: 500, color: 'white', background: '#2DB87A', border: 'none', borderRadius: 5, cursor: 'pointer', opacity: !newCustomerName.trim() || isPending ? 0.6 : 1, whiteSpace: 'nowrap' }}
                              >{isPending ? 'Creating…' : 'Create'}</button>
                              <button type="button" onClick={() => { setShowCustomerCreate(false); setCustomerCreateError(null) }}
                                style={{ height: 28, padding: '0 8px', fontSize: 12, color: 'var(--color-text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }}
                              >Cancel</button>
                            </div>
                            {customerCreateError && <p style={{ fontSize: 11, color: '#991B1B', margin: 0 }}>{customerCreateError}</p>}
                          </div>
                        )}

                        {/* Create new job */}
                        {!showJobCreate && !showCustomerCreate && (
                          <button type="button"
                            onClick={() => { setShowJobCreate(true); setNewJobName(bill.job_name_extracted ?? bill.vendor_po_reference ?? ''); setNewJobCustomerId(localMatchedCustomerId ?? '') }}
                            style={{ background: 'none', border: 'none', padding: 0, fontSize: 12, color: '#2DB87A', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, alignSelf: 'flex-start' }}
                          >
                            <i className="ti ti-plus" style={{ fontSize: 12 }} />
                            Create new job in QuickBooks
                          </button>
                        )}
                        {showJobCreate && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 10px', background: 'var(--color-background-secondary)', borderRadius: 6, border: '0.5px solid var(--color-border-tertiary)' }}>
                            <p style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-text-secondary)', margin: 0 }}>New job</p>
                            <select value={newJobCustomerId} onChange={e => setNewJobCustomerId(e.target.value)}
                              style={{ height: 28, border: `0.5px solid ${!newJobCustomerId ? '#FCA5A5' : 'var(--color-border-secondary)'}`, borderRadius: 5, padding: '0 8px', fontSize: 12, background: 'white' }}
                            >
                              <option value="">— Customer (required) —</option>
                              {liveCustomers.map(c => (
                                <option key={c.qb_job_id} value={c.qb_job_id}>{c.job_name ?? c.customer_name ?? c.qb_job_id}</option>
                              ))}
                            </select>
                            {!newJobCustomerId && (
                              <p style={{ fontSize: 11, color: '#991B1B', margin: 0 }}>Jobs must belong to a customer. Use "Create new customer" above if needed.</p>
                            )}
                            {(() => {
                              const dupes = newJobCustomerId && newJobName.trim()
                                ? liveJobs.filter(j => j.parent_id === newJobCustomerId && j.job_number && newJobName.includes(j.job_number))
                                : []
                              if (!dupes.length) return null
                              return (
                                <div style={{ background: '#FFFBEB', border: '0.5px solid #FDE68A', borderRadius: 5, padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 5 }}>
                                  <p style={{ fontSize: 11, fontWeight: 500, color: '#92400E', margin: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <i className="ti ti-alert-triangle" style={{ fontSize: 12 }} />
                                    A job with this number already exists
                                  </p>
                                  {dupes.map(j => (
                                    <div key={j.qb_job_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                                      <span style={{ fontSize: 11, color: '#92400E' }}>{j.job_name}</span>
                                      <button type="button"
                                        onClick={() => { setShowJobCreate(false); setNewJobName(''); setNewJobCustomerId(''); setHeaderJobPending({ jobId: j.qb_job_id, jobLabel: j.job_name ?? j.qb_job_id }) }}
                                        style={{ fontSize: 11, color: '#D97706', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', padding: 0 }}
                                      >Use this job →</button>
                                    </div>
                                  ))}
                                  <p style={{ fontSize: 11, color: '#B45309', margin: 0 }}>Or continue below to create a new job with a different name.</p>
                                </div>
                              )
                            })()}
                            <div className="flex items-center gap-2">
                              <input type="text" value={newJobName} onChange={e => setNewJobName(e.target.value)} placeholder="Job name" autoFocus
                                style={{ flex: 1, height: 28, border: '0.5px solid var(--color-border-secondary)', borderRadius: 5, padding: '0 8px', fontSize: 12 }}
                              />
                              <button type="button" disabled={!newJobName.trim() || !newJobCustomerId || isPending}
                                onClick={() => {
                                  setJobCreateError(null)
                                  startTransition(async () => {
                                    const result = await createJob(bill.company_id, newJobName.trim(), newJobCustomerId)
                                    if ('error' in result) {
                                      setJobCreateError(result.error)
                                    } else {
                                      const newJob: Job = { id: result.qbJobId, qb_job_id: result.qbJobId, job_number: result.jobNumber, job_name: result.jobName, customer_name: result.customerName, parent_id: newJobCustomerId, is_customer: false, status: 'active' }
                                      setLiveJobs(prev => [...prev, newJob])
                                      setShowJobCreate(false)
                                      setNewJobName('')
                                      setNewJobCustomerId('')
                                      setHeaderJobPending({ jobId: result.qbJobId, jobLabel: result.jobName, matchedOthers: result.matchedBillCount })
                                    }
                                  })
                                }}
                                style={{ height: 28, padding: '0 12px', fontSize: 12, fontWeight: 500, color: 'white', background: '#2DB87A', border: 'none', borderRadius: 5, cursor: 'pointer', opacity: !newJobName.trim() || !newJobCustomerId || isPending ? 0.6 : 1, whiteSpace: 'nowrap' }}
                              >{isPending ? 'Creating…' : 'Create'}</button>
                              <button type="button" onClick={() => { setShowJobCreate(false); setJobCreateError(null) }}
                                style={{ height: 28, padding: '0 8px', fontSize: 12, color: 'var(--color-text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }}
                              >Cancel</button>
                            </div>
                            {jobCreateError && (
                              <p style={{ fontSize: 11, color: '#991B1B', margin: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                                <i className="ti ti-circle-x" style={{ fontSize: 12 }} />
                                {jobCreateError}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </Field>
                </div>
              )}
            </div>

          {/* LINE ITEMS */}
          <Section title="Line Items">
            {lineItems.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>No line items extracted yet.</p>
            ) : (
              <div style={{ border: '0.5px solid var(--color-border-tertiary)', borderRadius: 6, overflow: 'hidden' }}>
                <div className="grid" style={{ gridTemplateColumns: [
                      '2.2fr 0.4fr 0.5fr 0.75fr 1.4fr',
                      jobCostingEnabled ? ' 1.8fr' : '',
                      classTrackingEnabled ? ' 1fr' : '',
                      ' 20px',
                    ].join(''), background: 'var(--color-background-secondary)', borderBottom: '0.5px solid var(--color-border-tertiary)', padding: '6px 8px' }}>
                  {([
                    { label: 'Description', align: 'left',  pl: 4 },
                    { label: 'Qty',         align: 'right', pl: 0 },
                    { label: 'Unit',        align: 'right', pl: 0 },
                    { label: 'Amount',      align: 'right', pl: 0 },
                    { label: 'GL Account',  align: 'left',  pl: 16 },
                    ...(jobCostingEnabled ? [{ label: 'Job', align: 'left', pl: 16 }] : []),
                    ...(classTrackingEnabled ? [{ label: 'Class', align: 'left', pl: 16 }] : []),
                    { label: '', align: 'left', pl: 0 },
                  ] as { label: string; align: 'left' | 'right'; pl: number }[]).map((h, idx) => (
                    <span key={idx} style={{ fontSize: 9, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-secondary)', textAlign: h.align, paddingLeft: h.pl }}>{h.label}</span>
                  ))}
                </div>
                {lineItems.map((item, i) => (
                  <div
                    key={item.line_id}
                    className="grid items-center"
                    style={{
                      gridTemplateColumns: [
                      '2.2fr 0.4fr 0.5fr 0.75fr 1.4fr',
                      jobCostingEnabled ? ' 1.8fr' : '',
                      classTrackingEnabled ? ' 1fr' : '',
                      ' 20px',
                    ].join(''),
                      borderBottom: i < lineItems.length - 1 ? '0.5px solid var(--color-border-tertiary)' : 'none',
                      padding: '2px 8px',
                      background: 'white',
                    }}
                  >
                    <InlineInput initialValue={item.description ?? ''} onSave={v => updateLineItem(item.line_id, { description: v || null })} placeholder="Description" />
                    <InlineInput initialValue={item.quantity != null ? String(item.quantity) : ''} onSave={async v => {
                      const qty = v ? parseFloat(v) : null
                      const ext = qty != null && item.unit_cost != null ? +(qty * item.unit_cost).toFixed(2) : item.extended_cost
                      setLineItems(ls => ls.map(li => li.line_id === item.line_id ? { ...li, quantity: qty, extended_cost: ext ?? li.extended_cost } : li))
                      await updateLineItem(item.line_id, { quantity: qty, ...(ext != null ? { extended_cost: ext } : {}) })
                    }} align="right" placeholder="—" />
                    <InlineInput initialValue={item.unit_cost != null ? String(item.unit_cost) : ''} onSave={async v => {
                      const cost = v ? parseFloat(v) : null
                      const ext = cost != null && item.quantity != null ? +(item.quantity * cost).toFixed(2) : item.extended_cost
                      setLineItems(ls => ls.map(li => li.line_id === item.line_id ? { ...li, unit_cost: cost, extended_cost: ext ?? li.extended_cost } : li))
                      await updateLineItem(item.line_id, { unit_cost: cost, ...(ext != null ? { extended_cost: ext } : {}) })
                    }} align="right" placeholder="—" />
                    <InlineInput initialValue={item.extended_cost != null ? String(item.extended_cost) : ''} onSave={async v => {
                      const ext = v ? parseFloat(v) : null
                      setLineItems(ls => ls.map(li => li.line_id === item.line_id ? { ...li, extended_cost: ext } : li))
                      await updateLineItem(item.line_id, { extended_cost: ext })
                    }} align="right" placeholder="enter amount" currency warn={item.extended_cost == null} />
                    <div style={{ paddingLeft: 8 }}>
                      <InlineSelect
                        initialValue={item.gl_account_id ?? ''}
                        options={expenseAccounts.map(a => ({ value: a.qb_account_id, label: a.name ?? a.qb_account_id }))}
                        title={item.gl_account_source ? SOURCE_BADGE[item.gl_account_source]?.label : undefined}
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
                    </div>
                    {jobCostingEnabled && (
                      <div style={{ paddingLeft: 8 }}>
                        <InlineSelect
                          initialValue={item.job_id ?? ''}
                          options={buildJobOptions(liveJobs)}
                          closedOptions={buildJobOptions(liveClosedJobs)}
                          onSave={async (v) => {
                            await updateLineItem(item.line_id, { job_id: v || null })
                            if (v && lineItems.length > 1) {
                              const job = liveJobs.find(j => j.qb_job_id === v)
                              const label = job ? buildJobLabel(job, v) : v
                              setJobApplyPrompt({ jobId: v, jobLabel: label })
                            }
                          }}
                          onSaveClosed={async (v) => {
                            await handleReopenAndSelect(v, async (id) => {
                              await updateLineItem(item.line_id, { job_id: id })
                              if (lineItems.length > 1) {
                                const job = [...liveJobs, ...liveClosedJobs].find(j => j.qb_job_id === id)
                                const label = job ? buildJobLabel(job, id) : id
                                setJobApplyPrompt({ jobId: id, jobLabel: label })
                              }
                            })
                          }}
                          placeholder="Job…"
                          emptyLabel="—"
                        />
                      </div>
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
                style={{ background: '#EBF5EF', border: '0.5px solid #C7D2FE', borderRadius: 6 }}
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
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        {/* Left: delete + reprocess + move to POs */}
        <div className="flex items-center flex-wrap gap-2">
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
              disabled={isPending || isReprocessing}
              title="Re-run OCR or re-apply vendor defaults. No credit charge."
              style={{
                background: 'white', color: isReprocessing ? '#2DB87A' : 'var(--color-text-secondary)',
                border: `0.5px solid ${isReprocessing ? '#2DB87A' : 'var(--color-border-secondary)'}`,
                borderRadius: 6, padding: '7px 12px',
                fontSize: 12, cursor: isPending || isReprocessing ? 'not-allowed' : 'pointer',
                opacity: isPending ? 0.6 : 1,
              }}
            >
              {isReprocessing
                ? <><i className="ti ti-loader-2" style={{ fontSize: 11, marginRight: 4 }} />Reprocessing…</>
                : 'Reprocess (free)'}
            </button>
          )}
          {!isPublished && (
            <button
              onClick={handleMoveToPO}
              disabled={isPending || isMovingToPO}
              title="This document is actually a PO confirmation, not an invoice. Moves it to Purchase Orders — no additional credit charged."
              style={{
                background: 'white', color: 'var(--color-text-secondary)',
                border: '0.5px solid var(--color-border-secondary)',
                borderRadius: 6, padding: '7px 12px',
                fontSize: 12, cursor: isPending || isMovingToPO ? 'not-allowed' : 'pointer',
                opacity: isPending ? 0.6 : 1,
              }}
            >
              {isMovingToPO
                ? <><i className="ti ti-loader-2" style={{ fontSize: 11, marginRight: 4 }} />Moving…</>
                : 'Move to POs'}
            </button>
          )}
        </div>

        {/* Right: status actions */}
        <div className="flex items-center flex-wrap gap-2">
          {publishError && (
            <span style={{ fontSize: 11, color: '#991B1B' }}>{publishError}</span>
          )}
          {savedFeedback && (
            <span style={{ fontSize: 11, color: '#065F46' }}>Saved ✓</span>
          )}
          <button
            onClick={handleCancel}
            style={{
              background: 'white', color: 'var(--color-text-secondary)',
              border: '0.5px solid var(--color-border-secondary)',
              borderRadius: 6, padding: '7px 16px',
              fontSize: 13, cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          {!isPublished && (
            <button
              onClick={handleSave}
              disabled={isPending}
              style={{
                background: 'white', color: 'var(--color-text-primary)',
                border: '0.5px solid var(--color-border-secondary)',
                borderRadius: 6, padding: '7px 16px',
                fontSize: 13, cursor: 'pointer',
                opacity: isPending ? 0.6 : 1,
              }}
            >
              {isPending ? 'Saving…' : 'Save'}
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
              {localStatus === 'sync_error' ? 'Retry Push to QB' : 'Publish to QuickBooks'}
            </button>
          )}
        </div>
      </div>
    </div>
    </FieldTipsContext.Provider>
  )

  const handleDownload = async () => {
    if (!stablePdfUrl) return
    try {
      const res = await fetch(stablePdfUrl)
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
      {stablePdfUrl && (
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
        {stablePdfUrl ? (
          <iframe
            src={`${stablePdfUrl}#navpanes=0`}
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
      {isDragging && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, cursor: 'col-resize' }} />
      )}
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
          <div
            style={{
              background: 'white', borderRadius: 10,
              width: 440, padding: '24px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
            }}
            onKeyDown={e => {
              if (e.key === 'Escape') { setShowReprocessModal(false); setReprocessComment('') }
            }}
          >
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
                <span style={{ color: '#64748B', marginLeft: 6 }}>
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
              onKeyDown={e => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault()
                  handleReprocessSubmit(reprocessComment)
                }
              }}
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
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus
                onClick={() => handleReprocessSubmit(reprocessComment)}
                disabled={isReprocessing}
                style={{
                  background: '#2DB87A', color: 'white',
                  border: 'none', borderRadius: 6, padding: '7px 16px',
                  fontSize: 13, fontWeight: 500,
                  cursor: isReprocessing ? 'not-allowed' : 'pointer',
                  opacity: isReprocessing ? 0.6 : 1,
                }}
              >
                {isReprocessing ? 'Reprocessing…' : 'Reprocess'}
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
        paddingTop: 8, marginBottom: 6,
        borderTop: '0.5px solid var(--color-border-tertiary)',
      }}>
        {title}
      </p>
      {children}
    </div>
  )
}

function Field({ label, helper, children }: { label: string; helper: string; children: React.ReactNode }) {
  const showTips = useContext(FieldTipsContext)
  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
        {label}
        {!showTips && helper && (
          <span title={helper} style={{ cursor: 'help', color: 'var(--color-text-tertiary)', fontSize: 11, lineHeight: 1 }}>ⓘ</span>
        )}
      </label>
      {children}
      {showTips && <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 3, lineHeight: 1.5 }}>{helper}</p>}
    </div>
  )
}

// ── AutoSave input ────────────────────────────────────────────────────────────

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

function AutoSaveInput({
  initialValue, onSave, type = 'text', placeholder, align, currency,
}: {
  initialValue: string
  onSave: (v: string) => Promise<void>
  type?: 'text' | 'date' | 'number'
  placeholder?: string
  align?: 'right'
  currency?: boolean
}) {
  const [value, setValue] = useState(initialValue)
  const [focused, setFocused] = useState(false)
  const [state, setState] = useState<SaveState>('idle')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => { setValue(initialValue) }, [initialValue])

  const handleBlur = async () => {
    setFocused(false)
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
  const displayValue = currency && !focused && value !== ''
    ? `$${parseFloat(value || '0').toFixed(2)}`
    : value

  return (
    <input
      type={currency && !focused ? 'text' : type}
      step={type === 'number' ? '0.01' : undefined}
      value={displayValue}
      onChange={e => {
        const raw = currency ? e.target.value.replace(/^\$/, '') : e.target.value
        setValue(raw)
      }}
      onFocus={() => setFocused(true)}
      onBlur={handleBlur}
      placeholder={placeholder}
      style={{
        width: '100%', height: 30,
        border: `0.5px solid ${borderColor ?? 'var(--color-border-secondary)'}`,
        borderRadius: 6, padding: '0 10px',
        fontSize: 12, color: 'var(--color-text-primary)',
        textAlign: align === 'right' ? 'right' : 'left',
        outline: 'none',
        background: 'white',
      }}
    />
  )
}

// ── Inline table inputs ────────────────────────────────────────────────────────

function InlineInput({ initialValue, onSave, placeholder, align, currency, warn }: { initialValue: string; onSave: (v: string) => Promise<void>; placeholder?: string; align?: 'right'; currency?: boolean; warn?: boolean }) {
  const [value, setValue] = useState(initialValue)
  const [focused, setFocused] = useState(false)
  const [hovered, setHovered] = useState(false)
  useEffect(() => { if (!focused) setValue(initialValue) }, [initialValue, focused])

  const displayValue = currency && !focused && value !== ''
    ? `$${parseFloat(value || '0').toFixed(2)}`
    : value

  const borderColor = focused ? '#2DB87A' : hovered ? '#C3DEC9' : warn ? '#FCA5A5' : 'transparent'
  const bgColor = focused ? 'white' : warn && !value ? '#FEF2F2' : 'transparent'

  return (
    <input
      value={displayValue}
      onChange={e => {
        const raw = currency ? e.target.value.replace(/^\$/, '') : e.target.value
        setValue(raw)
      }}
      onFocus={() => setFocused(true)}
      onBlur={async () => {
        setFocused(false)
        setHovered(false)
        try { await onSave(value) } catch { /* silent */ }
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      placeholder={placeholder}
      style={{
        width: '100%', border: `0.5px solid ${borderColor}`, borderRadius: 4,
        padding: '3px 4px', fontSize: 12,
        background: bgColor,
        color: warn && !value && !focused ? '#DC2626' : 'var(--color-text-primary)',
        textAlign: align === 'right' ? 'right' : 'left',
        outline: 'none',
      }}
    />
  )
}

function InlineSelect({ initialValue, options, closedOptions, onSave, onSaveClosed, placeholder, emptyLabel, title }: {
  initialValue: string
  options: { value: string; label: string }[]
  closedOptions?: { value: string; label: string }[]
  onSave: (v: string) => Promise<void>
  onSaveClosed?: (v: string) => Promise<void>
  placeholder: string
  emptyLabel: string
  title?: string
}) {
  const [value, setValue] = useState(initialValue)
  const [focused, setFocused] = useState(false)
  const [hovered, setHovered] = useState(false)

  useEffect(() => { setValue(initialValue) }, [initialValue])

  if (options.length === 0 && !closedOptions?.length) {
    return <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)', fontStyle: 'italic', padding: '0 4px' }}>{emptyLabel}</span>
  }

  const handleChange = async (newValue: string) => {
    if (!newValue) {
      setValue('')
      try { await onSave('') } catch { setValue(initialValue) }
      return
    }
    const isClosed = closedOptions?.some(o => o.value === newValue)
    setValue(newValue)
    try {
      if (isClosed && onSaveClosed) {
        await onSaveClosed(newValue)
      } else {
        await onSave(newValue)
      }
    } catch { setValue(initialValue) }
  }

  const borderColor = focused ? '#2DB87A' : hovered ? '#C3DEC9' : 'var(--color-border-secondary)'

  return (
    <select
      value={value}
      onChange={e => handleChange(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => { setFocused(false); setHovered(false) }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={title}
      style={{
        width: '100%', height: 28, border: `0.5px solid ${borderColor}`, borderRadius: 4,
        padding: '0 6px', fontSize: 12,
        background: 'white',
        color: 'var(--color-text-primary)', outline: 'none',
      }}
    >
      <option value="">{placeholder}</option>
      {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
      {closedOptions && closedOptions.length > 0 && (
        <optgroup label="── Closed ──">
          {closedOptions.map(opt => <option key={opt.value} value={opt.value}>🔒 {opt.label}</option>)}
        </optgroup>
      )}
    </select>
  )
}

const selectStyle: React.CSSProperties = {
  width: '100%', height: 30,
  border: '0.5px solid var(--color-border-secondary)',
  borderRadius: 6, padding: '0 10px',
  fontSize: 12, color: 'var(--color-text-primary)',
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

function SourceDot({ source }: { source: string }) {
  const cfg = SOURCE_BADGE[source]
  if (!cfg) return null
  return (
    <span
      title={cfg.label}
      style={{
        display: 'inline-block', flexShrink: 0,
        width: 7, height: 7, borderRadius: '50%',
        background: cfg.color, cursor: 'default',
      }}
    />
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
