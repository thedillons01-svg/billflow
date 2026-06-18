'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition, useEffect, useRef, createContext, useContext } from 'react'
import { closePO, deletePO, createVendorFromPO, addVendorToQBFromPO, updatePO, updatePOLineItem } from '../actions'
import { reopenJob, createJob } from '../../jobs/actions'
import { useDirty, useGuardedNavigate } from '@/components/unsaved-guard'

type Job = { qb_job_id: string; job_number: string | null; job_name: string | null; customer_name: string | null }
type Vendor = { vendor_id: string; vendor_name_display: string | null; vendor_name_extracted: string | null; qb_vendor_id: string | null }

type PO = {
  po_id: string
  company_id: string
  vendor_id: string | null
  vendor_name: string
  vendor_name_raw: string | null
  vendor_qb_linked: boolean
  po_number: string | null
  order_date: string | null
  expected_delivery_date: string | null
  job_id: string | null
  status: string
  qb_po_id: string | null
  qb_sync_error: string | null
  notes: string | null
  job_name_extracted: string | null
  customer_name_extracted: string | null
  matched_customer_qb_id: string | null
}

type LineItem = {
  line_id: string
  description: string | null
  quantity_ordered: number | null
  quantity_received: number | null
  unit_cost: number | null
  extended_cost: number | null
  job_id: string | null
  sort_order: number
}

type MatchedBill = {
  bill_id: string
  invoice_number: string | null
  total: number | null
  status: string
  vendor_name_raw: string | null
  bill_line_items: { job_id: string | null }[]
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

const FieldTipsContext = createContext(true)

function jobLabel(j: Job): string {
  const numInName = !!(j.job_number && j.job_name && new RegExp(`^${j.job_number}\\b`).test(j.job_name))
  return [j.customer_name, numInName ? null : j.job_number, j.job_name].filter(Boolean).join(' – ')
}

export function PODetail({
  po,
  lineItems: initialLineItems,
  matchedBills,
  jobs = [],
  closedJobs = [],
  customers = [],
  vendors = [],
  jobCostingEnabled = false,
  pushPosToQb = true,
}: {
  po: PO
  lineItems: LineItem[]
  matchedBills: MatchedBill[]
  jobs?: Job[]
  closedJobs?: Job[]
  customers?: Job[]
  vendors?: Vendor[]
  jobCostingEnabled?: boolean
  pushPosToQb?: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [pushError, setPushError] = useState<string | null>(null)
  const [pushSuccess, setPushSuccess] = useState(false)
  const [reprocessing, setReprocessing] = useState(false)
  const [reprocessResult, setReprocessResult] = useState<string | null>(null)
  const [localStatus, setLocalStatus] = useState(po.status)
  const [localVendorId, setLocalVendorId] = useState(po.vendor_id ?? '')
  const [localVendorQbLinked, setLocalVendorQbLinked] = useState(po.vendor_qb_linked)
  const [vendorActionError, setVendorActionError] = useState<string | null>(null)
  const [lineItems, setLineItems] = useState(initialLineItems)
  const [liveJobs, setLiveJobs] = useState(jobs)
  const [liveClosedJobs, setLiveClosedJobs] = useState(closedJobs)
  const [liveCustomers, setLiveCustomers] = useState(customers)
  const [headerJobPending, setHeaderJobPending] = useState<{ jobId: string; label: string } | null>(null)
  const [showJobCreate, setShowJobCreate] = useState(false)
  const [newJobName, setNewJobName] = useState('')
  const [newJobCustomerId, setNewJobCustomerId] = useState('')
  const [jobCreateError, setJobCreateError] = useState<string | null>(null)
  const [showCustomerCreate, setShowCustomerCreate] = useState(false)
  const [newCustomerName, setNewCustomerName] = useState('')
  const [customerCreateError, setCustomerCreateError] = useState<string | null>(null)
  const [form, setForm] = useState<{ po_number: string; order_date: string | null; expected_delivery_date: string | null }>({ po_number: po.po_number ?? '', order_date: po.order_date ?? '', expected_delivery_date: po.expected_delivery_date ?? '' })
  const [savedFeedback, setSavedFeedback] = useState(false)

  const { setDirty, registerSaveFn } = useDirty()
  const navigate = useGuardedNavigate()
  const saveFnRef = useRef<() => Promise<void>>(async () => {})

  // Do NOT sync lineItems from props — would overwrite unsaved edits on router.refresh()
  useEffect(() => { setLiveJobs(jobs) }, [jobs])
  useEffect(() => { setLiveClosedJobs(closedJobs) }, [closedJobs])
  useEffect(() => { setLiveCustomers(customers) }, [customers])

  useEffect(() => {
    registerSaveFn(() => saveFnRef.current())
    return () => registerSaveFn(null)
  }, [registerSaveFn])

  const badge = STATUS_BADGE[localStatus] ?? STATUS_BADGE.open
  const canReceive = ['open', 'partially_received'].includes(localStatus)
  const canClose = ['open', 'partially_received', 'received'].includes(localStatus)
  const isQBPushed = !!po.qb_po_id

  const selectedVendor = vendors.find(v => v.vendor_id === localVendorId)
  const vendorQbLinkedFromList = selectedVendor?.qb_vendor_id != null

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
    })
  }

  const handleReopenAndSelectJob = async (jobId: string, onSelect: (id: string) => void) => {
    await reopenJob(jobId)
    const job = liveClosedJobs.find(j => j.qb_job_id === jobId)
    setLiveClosedJobs(prev => prev.filter(j => j.qb_job_id !== jobId))
    if (job) setLiveJobs(prev => [...prev, job])
    onSelect(jobId)
  }

  const handleLineItemUpdate = (lineId: string, fields: Partial<LineItem>) => {
    setLineItems(prev => prev.map(li => li.line_id === lineId ? { ...li, ...fields } : li))
    setDirty(true)
  }

  const handleLineJobChange = async (lineId: string, jobId: string) => {
    if (liveClosedJobs.some(j => j.qb_job_id === jobId)) {
      await handleReopenAndSelectJob(jobId, (id) => {
        handleLineItemUpdate(lineId, { job_id: id })
      })
    } else {
      await handleLineItemUpdate(lineId, { job_id: jobId || null })
    }
  }

  saveFnRef.current = async () => {
    await updatePO(po.po_id, {
      vendor_id: localVendorId || null,
      po_number: form.po_number || null,
      order_date: form.order_date || null,
      expected_delivery_date: form.expected_delivery_date || null,
    })
    await Promise.all(lineItems.map(li =>
      updatePOLineItem(li.line_id, po.po_id, {
        description: li.description,
        quantity_ordered: li.quantity_ordered,
        unit_cost: li.unit_cost,
        extended_cost: li.extended_cost,
        job_id: li.job_id,
      })
    ))
    setDirty(false)
    setSavedFeedback(true)
    setTimeout(() => setSavedFeedback(false), 1500)
    router.refresh()
  }

  const handleSave = () => startTransition(() => saveFnRef.current())

  const totalOrdered = lineItems.reduce((s, l) => s + (l.extended_cost ?? 0), 0)
  const allAmountsMissing = lineItems.length > 0 && lineItems.every(l => !l.unit_cost && !l.extended_cost)
  const showJobColumn = jobCostingEnabled && (liveJobs.length > 0 || liveClosedJobs.length > 0)
  const [showTips, setShowTips] = useState(() => {
    if (typeof window === 'undefined') return true
    const stored = localStorage.getItem('purchasomatic:showFieldTips')
    return stored === null ? true : stored === 'true'
  })

  // Grid template: Description | Ord qty | Rcvd | Unit | Total | [Job]
  const gridCols = showJobColumn ? '2fr 60px 60px 80px 80px 1.4fr' : '2fr 60px 60px 80px 80px'

  return (
    <FieldTipsContext.Provider value={showTips}>
      {/* Fixed header */}
      <div className="flex-none px-5 py-3" style={{ borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
        <button
          onClick={() => navigate('/purchase-orders')}
          className="flex items-center gap-1 mb-2"
          style={{ fontSize: 12, color: 'var(--color-text-secondary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          <i className="ti ti-arrow-left" style={{ fontSize: 12 }} />
          Back to Purchase Orders
        </button>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 style={{ fontSize: 15, fontWeight: 500, color: 'var(--color-text-primary)' }}>
              {selectedVendor?.vendor_name_display ?? selectedVendor?.vendor_name_extracted ?? po.vendor_name}
            </h1>
            {form.po_number && (
              <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>
                PO #{form.po_number}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5" style={{ cursor: 'pointer', flexShrink: 0 }}>
              <input
                type="checkbox"
                checked={showTips}
                onChange={e => {
                  setShowTips(e.target.checked)
                  localStorage.setItem('purchasomatic:showFieldTips', String(e.target.checked))
                }}
                style={{ width: 12, height: 12, accentColor: '#2DB87A', cursor: 'pointer' }}
              />
              <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>Tips</span>
            </label>
            <span style={{
              display: 'inline-block', flexShrink: 0,
              background: badge.bg, color: badge.color,
              borderRadius: 4, padding: '3px 8px', fontSize: 10, fontWeight: 500,
            }}>
              {badge.label}
            </span>
          </div>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-auto">
        <div className="px-5 py-3 space-y-3">

          {/* QB push disabled notice */}
          {!pushPosToQb && (
            <Banner icon="ti-info-circle" color="gray">
              QuickBooks PO push is turned off. This PO is tracked in Purchasomatic only.{' '}
              <a href="/settings" style={{ color: '#2DB87A' }}>Change in Settings</a>
            </Banner>
          )}

          {/* QB sync error */}
          {po.qb_sync_error && (
            <Banner icon="ti-alert-circle" color="red">
              <strong>QuickBooks sync error</strong>
              <br />{po.qb_sync_error}
            </Banner>
          )}

          {/* Push success */}
          {pushSuccess && (
            <Banner icon="ti-circle-check" color="green">
              Purchase order pushed to QuickBooks successfully.
            </Banner>
          )}

          {/* Push error */}
          {pushError && (
            <Banner icon="ti-alert-circle" color="red">{pushError}</Banner>
          )}

          {/* Missing amounts warning */}
          {allAmountsMissing && (
            <Banner icon="ti-alert-triangle" color="yellow">
              No unit costs or amounts on any line item — this PO will push to QuickBooks with $0.00 on every line. Enter prices before pushing, or push now and correct in QuickBooks.
            </Banner>
          )}

          {/* Top action strip — receive only */}
          <div className="flex items-center gap-2 flex-wrap">
            {pushPosToQb && isQBPushed && (
              <span className="flex items-center gap-1.5" style={{ fontSize: 12, color: '#059669', fontWeight: 500 }}>
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
                  background: 'white', color: '#1A3D2B', border: '0.5px solid #C3DEC9',
                  borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 500, textDecoration: 'none',
                }}
              >
                <i className="ti ti-package" style={{ fontSize: 13 }} />
                Receive Items
              </Link>
            )}
          </div>

          {/* VENDOR */}
          <Section title="Vendor">
            <div className="space-y-2">
              <div>
                <label style={{ fontSize: 11, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>
                  Vendor record
                  {!showTips && <Tip text="The Purchasomatic vendor record that links this PO to a QuickBooks vendor. Required to push the PO to QuickBooks." />}
                </label>
                <select
                  value={localVendorId}
                  onChange={e => {
                    setLocalVendorId(e.target.value)
                    setVendorActionError(null)
                    setDirty(true)
                  }}
                  style={selectStyle}
                >
                  <option value="">
                    {po.vendor_name_raw ? `— ${po.vendor_name_raw} (unmatched) —` : '— Unmatched —'}
                  </option>
                  {vendors.map(v => (
                    <option key={v.vendor_id} value={v.vendor_id}>
                      {v.vendor_name_display ?? v.vendor_name_extracted ?? v.vendor_id}
                    </option>
                  ))}
                </select>
                {showTips && (
                  <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 3, lineHeight: 1.5 }}>
                    The Purchasomatic vendor record that links this PO to a QuickBooks vendor. Required to push the PO to QuickBooks.
                  </p>
                )}
                {localVendorId === '' && (
                  <p style={{ marginTop: 4, fontSize: 11, color: '#92400E' }}>
                    No vendor record linked — required to push to QuickBooks.
                  </p>
                )}
              </div>

              {/* Create vendor from OCR name */}
              {localVendorId === '' && po.vendor_name_raw && (
                <div>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => {
                      setVendorActionError(null)
                      startTransition(async () => {
                        const result = await createVendorFromPO(po.po_id, po.company_id, po.vendor_name_raw!)
                        if ('error' in result) {
                          setVendorActionError(result.error)
                        } else {
                          setLocalVendorId(result.vendorId)
                          setLocalVendorQbLinked(true)
                          router.refresh()
                        }
                      })
                    }}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      background: 'none', border: 'none', padding: 0,
                      fontSize: 12, color: '#2DB87A', cursor: 'pointer',
                      opacity: isPending ? 0.6 : 1,
                    }}
                  >
                    <i className="ti ti-plus" style={{ fontSize: 12 }} />
                    {isPending ? 'Creating…' : `Create "${po.vendor_name_raw}" as new vendor`}
                  </button>
                  {vendorActionError && (
                    <p style={{ marginTop: 4, fontSize: 11, color: '#991B1B' }}>{vendorActionError}</p>
                  )}
                </div>
              )}

              {/* Add to QB if vendor exists but not linked */}
              {localVendorId !== '' && !vendorQbLinkedFromList && pushPosToQb && (
                <div>
                  <p style={{ fontSize: 11, color: '#92400E', marginBottom: 4 }}>
                    Vendor has no QuickBooks link — cannot push PO.
                  </p>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => {
                      setVendorActionError(null)
                      startTransition(async () => {
                        const result = await addVendorToQBFromPO(localVendorId, po.company_id, po.po_id)
                        if (result.error) {
                          setVendorActionError(result.error)
                        } else {
                          setLocalVendorQbLinked(true)
                          router.refresh()
                        }
                      })
                    }}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      background: 'none', border: 'none', padding: 0,
                      fontSize: 12, color: '#2DB87A', cursor: 'pointer',
                      opacity: isPending ? 0.6 : 1,
                    }}
                  >
                    <i className="ti ti-building-store" style={{ fontSize: 12 }} />
                    {isPending ? 'Adding…' : 'Add to QuickBooks'}
                  </button>
                  {vendorActionError && (
                    <p style={{ marginTop: 4, fontSize: 11, color: '#991B1B' }}>{vendorActionError}</p>
                  )}
                </div>
              )}
            </div>
          </Section>

          {/* DETAILS */}
          <Section title="Details">
            <div className="grid gap-y-3" style={{ gridTemplateColumns: '140px 1fr' }}>
              <span style={labelStyle}>
                PO number
                {!showTips && <Tip text="The vendor's PO confirmation number. Used to automatically match incoming invoices to this PO." />}
              </span>
              <div>
                <InlineInput
                  initialValue={form.po_number}
                  placeholder="—"
                  onSave={v => { setForm(f => ({ ...f, po_number: v })); setDirty(true) }}
                />
                {showTips && <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 3, lineHeight: 1.5 }}>The vendor&apos;s PO confirmation number. Used to automatically match incoming invoices to this PO.</p>}
              </div>

              <span style={labelStyle}>
                Order date
                {!showTips && <Tip text="The date the purchase order was placed with the vendor." />}
              </span>
              <div>
                <SmartDateInput
                  initialValue={form.order_date}
                  onSave={v => { setForm(f => ({ ...f, order_date: v })); setDirty(true) }}
                />
                {showTips && <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 3, lineHeight: 1.5 }}>The date the purchase order was placed with the vendor.</p>}
              </div>

              <span style={labelStyle}>
                Expected delivery
                {!showTips && <Tip text="Estimated date the vendor will deliver the items. Set by the vendor on the PO confirmation." />}
              </span>
              <div>
                <SmartDateInput
                  initialValue={form.expected_delivery_date}
                  onSave={v => { setForm(f => ({ ...f, expected_delivery_date: v })); setDirty(true) }}
                />
                {showTips && <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 3, lineHeight: 1.5 }}>Estimated date the vendor will deliver the items. Set by the vendor on the PO confirmation.</p>}
              </div>

              {po.notes && (
                <>
                  <span style={labelStyle}>Notes</span>
                  <span style={{ fontSize: 12, color: 'var(--color-text-primary)', padding: '3px 4px' }}>{po.notes}</span>
                </>
              )}
            </div>
          </Section>

          {/* JOB — apply to all lines */}
          {showJobColumn && lineItems.length > 0 && (
            <Section title="Job">
              <div>
                {headerJobPending && (
                  <div className="flex items-center gap-2 mb-3" style={{ padding: '6px 10px', background: '#EBF5EF', border: '0.5px solid #A7F3D0', borderRadius: 6 }}>
                    <i className="ti ti-corner-down-right" style={{ fontSize: 12, color: '#059669', flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: '#065F46', flex: 1 }}>
                      Apply <strong>{headerJobPending.label}</strong> to all {lineItems.length} lines?
                    </span>
                    <button
                      onClick={() => {
                        const pending = headerJobPending
                        setHeaderJobPending(null)
                        setLineItems(ls => ls.map(li => ({ ...li, job_id: pending.jobId || null })))
                        setDirty(true)
                      }}
                      style={{ fontSize: 12, fontWeight: 500, color: 'white', background: '#059669', border: 'none', borderRadius: 4, padding: '3px 10px', cursor: 'pointer', flexShrink: 0 }}
                    >
                      Yes, all {lineItems.length}
                    </button>
                    <button
                      onClick={() => setHeaderJobPending(null)}
                      style={{ fontSize: 12, color: '#065F46', background: 'none', border: 'none', cursor: 'pointer', padding: '3px 6px' }}
                    >
                      No
                    </button>
                  </div>
                )}
                {!headerJobPending && (po.job_name_extracted || po.customer_name_extracted) && lineItems.every(li => !li.job_id) && (() => {
                  const customerFound = !!po.matched_customer_qb_id
                  const matchedCustomer = customerFound
                    ? (liveJobs.find(j => j.qb_job_id === po.matched_customer_qb_id) ?? liveClosedJobs.find(j => j.qb_job_id === po.matched_customer_qb_id))
                    : null
                  return (
                    <div className="flex items-start gap-2 mb-3" style={{ background: '#FFFBEB', border: '0.5px solid #FDE68A', borderRadius: 6, padding: '8px 10px' }}>
                      <i className="ti ti-search" style={{ fontSize: 13, color: '#D97706', marginTop: 1, flexShrink: 0 }} />
                      <div>
                        <p style={{ fontSize: 12, color: '#92400E', fontWeight: 500 }}>
                          {customerFound
                            ? `Customer matched: ${matchedCustomer ? jobLabel(matchedCustomer) : po.matched_customer_qb_id} — no job found yet`
                            : 'Job reference on PDF — no QuickBooks match found'}
                        </p>
                        {(po.job_name_extracted || po.customer_name_extracted) && (
                          <p style={{ fontSize: 11, color: '#92400E', marginTop: 2 }}>
                            {[po.job_name_extracted, po.customer_name_extracted].filter(Boolean).join(' / ')}
                          </p>
                        )}
                        <p style={{ fontSize: 11, color: '#B45309', marginTop: 4 }}>
                          {customerFound
                            ? 'Select an existing job below, or use "Create new job" — the customer will be pre-filled.'
                            : 'Select a matching job below, or create a new one.'}
                        </p>
                      </div>
                    </div>
                  )
                })()}
                <label style={{ fontSize: 11, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>
                  Apply job to all line items at once. Individual lines can still be changed below.
                  {!showTips && <Tip text="Job costing links this purchase to a QuickBooks job so material costs roll up to job profitability reports." />}
                </label>
                {showTips && <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 6, lineHeight: 1.5 }}>Job costing links this purchase to a QuickBooks job so material costs roll up to job profitability reports.</p>}
                <InlineSelect
                  initialValue={
                    lineItems.length > 0 && lineItems.every(li => li.job_id === lineItems[0].job_id)
                      ? (lineItems[0].job_id ?? '')
                      : ''
                  }
                  options={liveJobs.map(j => ({ value: j.qb_job_id, label: jobLabel(j) }))}
                  closedOptions={liveClosedJobs.map(j => ({ value: j.qb_job_id, label: jobLabel(j) }))}
                  placeholder={
                    lineItems.every(li => li.job_id === lineItems[0].job_id) ? 'No job assigned' : 'Mixed — select to apply all'
                  }
                  onSave={async v => {
                    if (!v) {
                      // Clearing job — prompt to clear all lines
                      if (lineItems.length > 1) {
                        setHeaderJobPending({ jobId: '', label: 'No job' })
                      } else if (lineItems.length === 1) {
                        await handleLineItemUpdate(lineItems[0].line_id, { job_id: null })
                      }
                      return
                    }
                    const j = liveJobs.find(j => j.qb_job_id === v)
                    if (lineItems.length > 1) {
                      setHeaderJobPending({ jobId: v, label: j ? jobLabel(j) : v })
                    } else if (lineItems.length === 1) {
                      await handleLineItemUpdate(lineItems[0].line_id, { job_id: v })
                    }
                  }}
                  onSaveClosed={async v => {
                    await handleReopenAndSelectJob(v, id => {
                      const j = [...liveJobs, ...liveClosedJobs].find(j => j.qb_job_id === id)
                      if (lineItems.length > 1) {
                        setHeaderJobPending({ jobId: id, label: j ? jobLabel(j) : id })
                      } else if (lineItems.length === 1) {
                        handleLineItemUpdate(lineItems[0].line_id, { job_id: id })
                      }
                    })
                  }}
                />
                {(lineItems.some(li => !li.job_id) || showJobCreate || showCustomerCreate) && (
                <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>

                    {/* Create new customer */}
                    {!showCustomerCreate && !showJobCreate && (
                      <button type="button"
                        onClick={() => { setShowCustomerCreate(true); setNewCustomerName(po.customer_name_extracted ?? ''); setCustomerCreateError(null) }}
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
                          <input
                            type="text"
                            value={newCustomerName}
                            onChange={e => setNewCustomerName(e.target.value)}
                            placeholder="Customer name"
                            autoFocus
                            style={{ flex: 1, height: 28, border: '0.5px solid var(--color-border-secondary)', borderRadius: 5, padding: '0 8px', fontSize: 12 }}
                          />
                          <button type="button"
                            disabled={!newCustomerName.trim() || isPending}
                            onClick={() => {
                              setCustomerCreateError(null)
                              startTransition(async () => {
                                const result = await createJob(po.company_id, newCustomerName.trim(), undefined)
                                if ('error' in result) {
                                  setCustomerCreateError(result.error)
                                } else {
                                  const newCust: Job = { qb_job_id: result.qbJobId, job_number: result.jobNumber, job_name: result.jobName, customer_name: null }
                                  setLiveCustomers(prev => [...prev, newCust])
                                  setNewJobCustomerId(result.qbJobId)
                                  setNewJobName(po.job_name_extracted ?? '')
                                  setShowCustomerCreate(false)
                                  setNewCustomerName('')
                                  setShowJobCreate(true)
                                }
                              })
                            }}
                            style={{ height: 28, padding: '0 12px', fontSize: 12, fontWeight: 500, color: 'white', background: '#2DB87A', border: 'none', borderRadius: 5, cursor: 'pointer', opacity: !newCustomerName.trim() || isPending ? 0.6 : 1, whiteSpace: 'nowrap' }}
                          >
                            {isPending ? 'Creating…' : 'Create'}
                          </button>
                          <button type="button"
                            onClick={() => { setShowCustomerCreate(false); setCustomerCreateError(null) }}
                            style={{ height: 28, padding: '0 8px', fontSize: 12, color: 'var(--color-text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }}
                          >Cancel</button>
                        </div>
                        {customerCreateError && (
                          <p style={{ fontSize: 11, color: '#991B1B', margin: 0 }}>{customerCreateError}</p>
                        )}
                      </div>
                    )}

                    {/* Create new job */}
                    {!showJobCreate && !showCustomerCreate && (
                      <button type="button"
                        onClick={() => {
                          setShowJobCreate(true)
                          setNewJobName(po.job_name_extracted ?? '')
                          setNewJobCustomerId(po.matched_customer_qb_id ?? '')
                        }}
                        style={{ background: 'none', border: 'none', padding: 0, fontSize: 12, color: '#2DB87A', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, alignSelf: 'flex-start' }}
                      >
                        <i className="ti ti-plus" style={{ fontSize: 12 }} />
                        Create new job in QuickBooks
                      </button>
                    )}
                    {showJobCreate && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 10px', background: 'var(--color-background-secondary)', borderRadius: 6, border: '0.5px solid var(--color-border-tertiary)' }}>
                        <p style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-text-secondary)', margin: 0 }}>New job</p>
                        <select
                          value={newJobCustomerId}
                          onChange={e => setNewJobCustomerId(e.target.value)}
                          style={{ height: 28, border: `0.5px solid ${!newJobCustomerId ? '#FCA5A5' : 'var(--color-border-secondary)'}`, borderRadius: 5, padding: '0 8px', fontSize: 12, background: 'white' }}
                        >
                          <option value="">— Customer (required) —</option>
                          {liveCustomers.map(c => (
                            <option key={c.qb_job_id} value={c.qb_job_id}>
                              {c.job_name ?? c.customer_name ?? c.qb_job_id}
                            </option>
                          ))}
                        </select>
                        {!newJobCustomerId && (
                          <p style={{ fontSize: 11, color: '#991B1B', margin: 0 }}>
                            Jobs must belong to a customer. Use "Create new customer" above if the customer doesn't exist yet.
                          </p>
                        )}
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={newJobName}
                            onChange={e => setNewJobName(e.target.value)}
                            placeholder="Job name"
                            autoFocus
                            style={{ flex: 1, height: 28, border: '0.5px solid var(--color-border-secondary)', borderRadius: 5, padding: '0 8px', fontSize: 12 }}
                          />
                          <button type="button"
                            disabled={!newJobName.trim() || !newJobCustomerId || isPending}
                            onClick={() => {
                              setJobCreateError(null)
                              startTransition(async () => {
                                const result = await createJob(po.company_id, newJobName.trim(), newJobCustomerId)
                                if ('error' in result) {
                                  setJobCreateError(result.error)
                                } else {
                                  const newJob: Job = { qb_job_id: result.qbJobId, job_number: result.jobNumber, job_name: result.jobName, customer_name: result.customerName }
                                  setLiveJobs(prev => [...prev, newJob])
                                  setShowJobCreate(false)
                                  setNewJobName('')
                                  setNewJobCustomerId('')
                                  setHeaderJobPending({ jobId: result.qbJobId, label: result.jobName })
                                }
                              })
                            }}
                            style={{ height: 28, padding: '0 12px', fontSize: 12, fontWeight: 500, color: 'white', background: '#2DB87A', border: 'none', borderRadius: 5, cursor: 'pointer', opacity: !newJobName.trim() || !newJobCustomerId || isPending ? 0.6 : 1, whiteSpace: 'nowrap' }}
                          >
                            {isPending ? 'Creating…' : 'Create'}
                          </button>
                          <button type="button"
                            onClick={() => { setShowJobCreate(false); setJobCreateError(null) }}
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
              </div>
            </Section>
          )}

          {/* LINE ITEMS */}
          <Section title={`Line Items${totalOrdered > 0 ? ` — $${totalOrdered.toFixed(2)} total` : ''}`}>
            {lineItems.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>No line items extracted.</p>
            ) : (
              <div style={{ border: '0.5px solid var(--color-border-tertiary)', borderRadius: 6, overflow: 'hidden' }}>
                {/* Header row */}
                <div className="grid px-2 py-2" style={{
                  gridTemplateColumns: gridCols,
                  background: 'var(--color-background-secondary)',
                  borderBottom: '0.5px solid var(--color-border-tertiary)',
                }}>
                  {([
                    { label: 'Description', align: 'left',  tip: null },
                    { label: 'Ord',         align: 'right', tip: 'Quantity ordered — edit to correct OCR errors.' },
                    { label: 'Rcvd',        align: 'right', tip: 'Quantity received so far. Updated via the Receive Items screen.' },
                    { label: 'Unit',        align: 'right', tip: 'Unit cost per item. Multiplied by quantity to calculate the line total.' },
                    { label: 'Total',       align: 'right', tip: 'Extended cost (unit × qty). Edit directly if no unit price is available.' },
                    ...(showJobColumn ? [{ label: 'Job', align: 'left', tip: 'QuickBooks job to charge this line to.' }] : []),
                  ] as { label: string; align: 'left' | 'right'; tip: string | null }[]).map((h, i) => (
                    <span key={i} style={{
                      fontSize: 9, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em',
                      color: 'var(--color-text-secondary)', textAlign: h.align,
                      paddingRight: h.align === 'right' ? 4 : 0,
                      display: 'inline-flex', alignItems: 'center', justifyContent: h.align === 'right' ? 'flex-end' : 'flex-start',
                    }}>
                      {h.label}
                      {h.tip && !showTips && <Tip text={h.tip} />}
                    </span>
                  ))}
                </div>

                {lineItems.map((li, i) => {
                  const ordered   = li.quantity_ordered ?? 0
                  const received  = li.quantity_received ?? 0
                  const recvStatus = received === 0 ? 'none' : received >= ordered ? 'full' : 'partial'
                  return (
                    <div
                      key={li.line_id}
                      className="grid items-center px-2"
                      style={{
                        gridTemplateColumns: gridCols,
                        borderBottom: i < lineItems.length - 1 ? '0.5px solid var(--color-border-tertiary)' : 'none',
                        background: i % 2 === 0 ? 'white' : 'var(--color-background-secondary)',
                        minHeight: 36,
                      }}
                    >
                      {/* Description */}
                      <InlineInput
                        initialValue={li.description ?? ''}
                        placeholder="Description"
                        onSave={v => handleLineItemUpdate(li.line_id, { description: v || null })}
                      />

                      {/* Qty ordered */}
                      <InlineInput
                        initialValue={li.quantity_ordered != null ? String(li.quantity_ordered) : ''}
                        placeholder="—"
                        align="right"
                        onSave={async v => {
                          const qty = v ? parseFloat(v) : null
                          const ext = qty != null && li.unit_cost != null ? +(qty * li.unit_cost).toFixed(2) : li.extended_cost
                          await handleLineItemUpdate(li.line_id, { quantity_ordered: isNaN(qty!) ? null : qty, extended_cost: ext })
                        }}
                      />

                      {/* Qty received (read-only) */}
                      <span style={{
                        fontSize: 12, textAlign: 'right', paddingRight: 4,
                        color: recvStatus === 'full' ? '#059669' : recvStatus === 'partial' ? '#D97706' : 'var(--color-text-tertiary)',
                        fontWeight: recvStatus !== 'none' ? 500 : 400,
                      }}>
                        {received > 0 ? received : '—'}
                      </span>

                      {/* Unit cost */}
                      <InlineInput
                        initialValue={li.unit_cost != null ? String(li.unit_cost) : ''}
                        placeholder="—"
                        align="right"
                        currency
                        warn={li.unit_cost == null && li.extended_cost == null}
                        onSave={async v => {
                          const cost = v ? parseFloat(v) : null
                          const parsed = isNaN(cost!) ? null : cost
                          const ext = parsed != null && li.quantity_ordered != null ? +(li.quantity_ordered * parsed).toFixed(2) : li.extended_cost
                          handleLineItemUpdate(li.line_id, { unit_cost: parsed, extended_cost: ext })
                        }}
                      />

                      {/* Extended cost — editable directly if no unit cost */}
                      <InlineInput
                        initialValue={li.extended_cost != null ? String(li.extended_cost) : ''}
                        placeholder="—"
                        align="right"
                        currency
                        warn={li.unit_cost == null && li.extended_cost == null}
                        onSave={async v => {
                          const ext = v ? parseFloat(v) : null
                          handleLineItemUpdate(li.line_id, { extended_cost: isNaN(ext!) ? null : ext })
                        }}
                      />

                      {/* Job */}
                      {showJobColumn && (
                        <InlineSelect
                          initialValue={li.job_id ?? ''}
                          options={liveJobs.map(j => ({ value: j.qb_job_id, label: jobLabel(j) }))}
                          closedOptions={liveClosedJobs.map(j => ({ value: j.qb_job_id, label: jobLabel(j) }))}
                          placeholder="No job"
                          onSave={v => handleLineJobChange(li.line_id, v)}
                          onSaveClosed={v => handleLineJobChange(li.line_id, v)}
                        />
                      )}
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

          {/* MATCHED BILLS */}
          {matchedBills.length > 0 && (
            <Section title="Matched Invoice">
              <div className="space-y-2">
                {matchedBills.map(bill => {
                  const billBadge = BILL_STATUS_BADGE[bill.status] ?? BILL_STATUS_BADGE.draft
                  const allJobs = [...liveJobs, ...liveClosedJobs]
                  const uniqueJobIds = [...new Set((bill.bill_line_items ?? []).map(li => li.job_id).filter((id): id is string => !!id))]
                  const jobNames = uniqueJobIds.map(id => {
                    const j = allJobs.find(j => j.qb_job_id === id)
                    return j ? jobLabel(j) : null
                  }).filter(Boolean)
                  return (
                    <Link
                      key={bill.bill_id}
                      href={`/bills/${bill.bill_id}`}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '10px 12px', border: '0.5px solid var(--color-border-secondary)',
                        borderRadius: 6, textDecoration: 'none', background: 'var(--color-background-secondary)',
                      }}
                    >
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>
                          {bill.invoice_number ? `Invoice #${bill.invoice_number}` : 'Invoice'}
                        </p>
                        <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>
                          {bill.total != null ? `$${Number(bill.total).toFixed(2)}` : ''}
                          {jobNames.length > 0 && ` · ${jobNames.join(', ')}`}
                          {' · View in Bills'}
                        </p>
                      </div>
                      <span style={{
                        background: billBadge.bg, color: billBadge.color,
                        borderRadius: 4, padding: '2px 8px', fontSize: 10, fontWeight: 500,
                      }}>
                        {billBadge.label}
                      </span>
                    </Link>
                  )
                })}
              </div>
            </Section>
          )}

          {matchedBills.length === 0 && localStatus !== 'closed' && (
            <Section title="Matched Invoice">
              <p style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>
                No invoice matched yet. When a vendor emails an invoice that references this PO number, it will be linked here automatically.
              </p>
            </Section>
          )}

          {reprocessResult && (
            <Banner icon="ti-circle-check" color="green">{reprocessResult}</Banner>
          )}

          {/* Bottom action bar */}
          <div className="flex items-center gap-2 flex-wrap" style={{ paddingTop: 8, borderTop: '0.5px solid var(--color-border-tertiary)' }}>
            <ActionButton onClick={handleSave} disabled={isPending} primary icon="ti-device-floppy">
              {savedFeedback ? 'Saved!' : 'Save'}
            </ActionButton>
            {pushPosToQb && !isQBPushed && !pushSuccess && vendorQbLinkedFromList && (
              <ActionButton onClick={handlePushToQB} disabled={isPending} primary icon="ti-upload">
                Push to QuickBooks
              </ActionButton>
            )}
            <ActionButton
              onClick={async () => {
                setReprocessing(true)
                setReprocessResult(null)
                try {
                  const res = await fetch(`/api/purchase-orders/${po.po_id}/reprocess`, { method: 'POST' })
                  const json = await res.json()
                  if (!res.ok) {
                    setReprocessResult(`Reprocess failed: ${json.error ?? 'unknown error'}`)
                  } else {
                    const msg = json.matchedJobId
                      ? 'Reprocessed — job matched and applied to all lines.'
                      : json.matchedCustomerId
                        ? 'Reprocessed — customer identified. No existing job matched; use "Create new job" below.'
                        : 'Reprocessed — no job or customer match found. Check the PDF for a job reference and assign manually.'
                    setReprocessResult(msg)
                    // Full reload so line items and vendor re-initialize from fresh server data
                    window.location.reload()
                  }
                } finally {
                  setReprocessing(false)
                }
              }}
              disabled={reprocessing || isPending}
              icon="ti-scan"
              title="Re-run extraction on the original PDF and re-attempt job/customer matching. No credit charge."
            >
              {reprocessing ? 'Reprocessing…' : 'Reprocess PDF'}
            </ActionButton>
            {lineItems.length > 0 && (
              <ActionButton
                onClick={() => {
                  setLineItems(lineItems.map(li => ({
                    ...li,
                    extended_cost: li.quantity_ordered != null && li.unit_cost != null
                      ? +((li.quantity_ordered * li.unit_cost).toFixed(2))
                      : li.extended_cost,
                  })))
                  setDirty(true)
                }}
                disabled={isPending}
                icon="ti-refresh"
              >
                Recalculate
              </ActionButton>
            )}
            {canClose && (
              <ActionButton onClick={handleClose} disabled={isPending} icon="ti-lock" title="Mark this PO as closed and remove it from the Open queue. Use when no further deliveries or invoices are expected.">Close PO</ActionButton>
            )}
            <ActionButton onClick={handleDelete} disabled={isPending} danger icon="ti-trash">Delete</ActionButton>
          </div>

        </div>
      </div>
    </FieldTipsContext.Provider>
  )
}

// ── Shared styles ──────────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = { fontSize: 12, color: 'var(--color-text-secondary)', padding: '3px 0', alignSelf: 'center' }

const selectStyle: React.CSSProperties = {
  width: '100%', height: 30,
  border: '0.5px solid var(--color-border-secondary)',
  borderRadius: 6, padding: '0 10px',
  fontSize: 12, color: 'var(--color-text-primary)', background: 'white',
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Tip({ text }: { text: string }) {
  const [rect, setRect] = useState<DOMRect | null>(null)
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', marginLeft: 4, verticalAlign: 'middle' }}>
      <i
        className="ti ti-info-circle"
        style={{ fontSize: 11, color: 'var(--color-text-tertiary)', cursor: 'help' }}
        onMouseEnter={e => setRect((e.currentTarget as HTMLElement).getBoundingClientRect())}
        onMouseLeave={() => setRect(null)}
      />
      {rect && (
        <span style={{
          position: 'fixed',
          left: rect.left + rect.width / 2,
          top: rect.top - 6,
          transform: 'translateX(-50%) translateY(-100%)',
          background: '#1F2937', color: 'white', fontSize: 11,
          padding: '6px 9px', borderRadius: 5,
          width: 200, textAlign: 'left', whiteSpace: 'normal', lineHeight: 1.45,
          zIndex: 9999, pointerEvents: 'none',
          boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
        }}>
          {text}
        </span>
      )}
    </span>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p style={{
        fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em',
        color: 'var(--color-text-secondary)', marginBottom: 10,
        paddingTop: 8, borderTop: '0.5px solid var(--color-border-tertiary)',
      }}>
        {title}
      </p>
      {children}
    </div>
  )
}

function Banner({ icon, color, children }: { icon: string; color: 'gray' | 'red' | 'green' | 'yellow'; children: React.ReactNode }) {
  const colors = {
    gray:   { bg: '#F3F4F6', border: '#E5E7EB', text: 'var(--color-text-secondary)', icon: 'var(--color-text-secondary)' },
    red:    { bg: '#FEF2F2', border: '#FECACA', text: '#991B1B', icon: '#DC2626' },
    green:  { bg: '#D1FAE5', border: '#6EE7B7', text: '#065F46', icon: '#059669' },
    yellow: { bg: '#FFFBEB', border: '#FDE68A', text: '#92400E', icon: '#D97706' },
  }
  const c = colors[color]
  return (
    <div className="flex items-start gap-2" style={{ background: c.bg, border: `0.5px solid ${c.border}`, borderRadius: 6, padding: '10px 12px' }}>
      <i className={`ti ${icon}`} style={{ fontSize: 14, color: c.icon, marginTop: 1, flexShrink: 0 }} />
      <p style={{ fontSize: 12, color: c.text }}>{children}</p>
    </div>
  )
}

function ActionButton({ onClick, disabled, children, primary, danger, icon, title }: {
  onClick: () => void; disabled: boolean; children: React.ReactNode
  primary?: boolean; danger?: boolean; icon?: string; title?: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        background: primary ? '#2DB87A' : 'white',
        color: primary ? 'white' : danger ? '#DC2626' : '#1A3D2B',
        border: `0.5px solid ${primary ? '#2DB87A' : danger ? '#FCA5A5' : '#C3DEC9'}`,
        borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 500,
        cursor: 'pointer', opacity: disabled ? 0.6 : 1,
      }}
    >
      {icon && <i className={`ti ${icon}`} style={{ fontSize: 13 }} />}
      {children}
    </button>
  )
}

function InlineInput({ initialValue, onSave, placeholder, align, currency, warn, type = 'text' }: {
  initialValue: string
  onSave: (v: string) => Promise<void> | void
  placeholder?: string
  align?: 'right'
  currency?: boolean
  warn?: boolean
  type?: string
}) {
  const [value, setValue] = useState(initialValue)
  const [focused, setFocused] = useState(false)
  const [hovered, setHovered] = useState(false)
  // Only sync from parent when not focused — prevents the race condition where
  // setFocused(false) triggers a re-render before onSave updates parent state,
  // which would cause the useEffect to reset the typed value back to "".
  useEffect(() => { if (!focused) setValue(initialValue) }, [initialValue, focused])

  const displayValue = currency && !focused && value !== ''
    ? `$${parseFloat(value || '0').toFixed(2)}`
    : value

  const borderColor = focused ? '#2DB87A' : hovered ? '#C3DEC9' : warn ? '#FCA5A5' : 'transparent'
  const bgColor = focused ? 'white' : warn && !value ? '#FEF2F2' : 'transparent'

  return (
    <input
      type={type}
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
        width: '100%', height: 28, border: `0.5px solid ${borderColor}`, borderRadius: 4,
        padding: '0 6px', fontSize: 12,
        background: bgColor,
        color: warn && !value && !focused ? '#DC2626' : 'var(--color-text-primary)',
        textAlign: align === 'right' ? 'right' : 'left',
        outline: 'none',
      }}
    />
  )
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function SmartDateInput({ initialValue, onSave }: {
  initialValue: string | null
  onSave: (v: string | null) => void
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(initialValue ?? '')
  const [hovered, setHovered] = useState(false)

  useEffect(() => { if (!editing) setValue(initialValue ?? '') }, [initialValue, editing])

  const isValid = !value || ISO_DATE.test(value)

  if (editing) {
    return (
      <input
        type="date"
        autoFocus
        value={isValid ? value : ''}
        onChange={e => setValue(e.target.value)}
        onBlur={() => {
          setEditing(false)
          onSave(value || null)
        }}
        style={{
          width: '100%', height: 28,
          border: '0.5px solid #2DB87A', borderRadius: 4,
          padding: '0 6px', fontSize: 12,
          background: 'white', color: 'var(--color-text-primary)',
          outline: 'none',
        }}
      />
    )
  }

  return (
    <div
      onClick={() => setEditing(true)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        height: 28, padding: '0 6px', borderRadius: 4,
        border: `0.5px solid ${hovered ? '#C3DEC9' : 'transparent'}`,
        cursor: 'text', fontSize: 12,
        color: value ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
      }}
    >
      <span>{value || '—'}</span>
      {value && !isValid && (
        <span title="Not a valid date — click to fix before pushing to QuickBooks" style={{
          fontSize: 10, fontWeight: 500, color: '#92400E',
          background: '#FEF3C7', border: '0.5px solid #FDE68A',
          borderRadius: 3, padding: '1px 5px', cursor: 'help',
        }}>
          Invalid date
        </span>
      )}
    </div>
  )
}

function InlineSelect({ initialValue, options, closedOptions, onSave, onSaveClosed, placeholder }: {
  initialValue: string
  options: { value: string; label: string }[]
  closedOptions?: { value: string; label: string }[]
  onSave: (v: string) => Promise<void> | void
  onSaveClosed?: (v: string) => Promise<void> | void
  placeholder: string
}) {
  const [value, setValue] = useState(initialValue)
  const [focused, setFocused] = useState(false)
  const [hovered, setHovered] = useState(false)
  useEffect(() => { setValue(initialValue) }, [initialValue])

  if (options.length === 0 && !closedOptions?.length) {
    return <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)', fontStyle: 'italic', padding: '0 4px' }}>—</span>
  }

  const handleChange = async (newValue: string) => {
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
      style={{
        width: '100%', height: 28, border: `0.5px solid ${borderColor}`, borderRadius: 4,
        padding: '0 6px', fontSize: 12,
        background: 'white',
        color: 'var(--color-text-primary)', outline: 'none',
      }}
    >
      <option value="">{placeholder}</option>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      {closedOptions && closedOptions.length > 0 && (
        <optgroup label="── Closed ──">
          {closedOptions.map(o => <option key={o.value} value={o.value}>🔒 {o.label}</option>)}
        </optgroup>
      )}
    </select>
  )
}
