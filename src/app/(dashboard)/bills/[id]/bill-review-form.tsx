'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useRef, useTransition } from 'react'
import { updateBill, updateLineItem, setBillStatus, softDeleteBill, addLineItem, deleteLineItem, saveLineItemMapping, enableVendorAutoPublish } from '../actions'

type Account = { id: string; qb_account_id: string; name: string | null; account_type: string | null }
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
  is_tax_line: boolean | null
  gl_account_source: string | null
}

type Bill = {
  bill_id: string
  company_id: string
  vendor_id: string | null
  vendor_name_raw: string | null
  invoice_number: string | null
  invoice_date: string | null
  due_date: string | null
  total: number | null
  line_items_total: number | null
  description: string | null
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
  vendorPromo,
}: {
  bill: Bill
  lineItems: LineItem[]
  accounts: Account[]
  jobs: Job[]
  vendorPromo?: { vendorId: string; invoicesProcessed: number } | null
}) {
  const router = useRouter()
  const [localStatus, setLocalStatus] = useState(bill.status)
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

  const handleReprocess = () => {
    startTransition(async () => {
      const res = await fetch(`/api/bills/${bill.bill_id}/reprocess`, { method: 'POST' })
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
  const canReprocess = localStatus === 'ocr_error'
  const isPublished = localStatus === 'published'

  return (
    <>
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
          <h1 style={{ fontSize: 15, fontWeight: 500, color: 'var(--color-text-primary)' }}>
            {bill.vendor_name_raw ?? 'Unknown Vendor'}
          </h1>
          <span style={{
            display: 'inline-block',
            background: badge.bg, color: badge.color,
            borderRadius: 4, padding: '3px 8px',
            fontSize: 10, fontWeight: 500, flexShrink: 0,
          }}>
            {badge.label}
          </span>
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
                    const res = await fetch('/api/quickbooks/sync', { method: 'POST' })
                    if (res.ok) router.refresh()
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
                Find Match
              </button>
            </div>
          )}
          {bill.autopublish_hold_reason && localStatus !== 'pending_job_match' && (
            <div style={{ background: '#FEF3C7', border: '0.5px solid #FDE68A', borderRadius: 6, padding: '10px 12px', fontSize: 12, color: '#92400E' }}>
              {bill.autopublish_hold_reason}
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
                onClick={handleReprocess}
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
                <Field label="Invoice #" helper="The invoice number from the vendor PDF. Used for duplicate detection — checked against vendor + invoice number combination.">
                  <AutoSaveInput
                    initialValue={bill.invoice_number ?? ''}
                    onSave={v => updateBill(bill.bill_id, { invoice_number: v || null })}
                    placeholder="e.g. INV-12345"
                  />
                </Field>
              </div>
              <Field label="Invoice Date" helper="Date on the vendor invoice.">
                <AutoSaveInput type="date" initialValue={bill.invoice_date ?? ''} onSave={v => updateBill(bill.bill_id, { invoice_date: v || null })} />
              </Field>
              <Field label="Due Date" helper="Payment due date. Can be blank.">
                <AutoSaveInput type="date" initialValue={bill.due_date ?? ''} onSave={v => updateBill(bill.bill_id, { due_date: v || null })} />
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
              <div className="col-span-2">
                <Field label="Invoice Total" helper="The total amount from the invoice header. Must match the line items sum exactly for auto-publish.">
                  <AutoSaveInput type="number" initialValue={bill.total != null ? String(bill.total) : ''} onSave={v => updateBill(bill.bill_id, { total: v ? parseFloat(v) : null })} align="right" placeholder="0.00" />
                </Field>
              </div>
            </div>
          </Section>

          {/* LINE ITEMS */}
          <Section title="Line Items">
            {lineItems.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>No line items extracted yet.</p>
            ) : (
              <div style={{ border: '0.5px solid var(--color-border-tertiary)', borderRadius: 6, overflow: 'hidden' }}>
                <div className="grid" style={{ gridTemplateColumns: '3fr 0.6fr 0.8fr 0.9fr 1.4fr 1.2fr 24px', background: 'var(--color-background-secondary)', borderBottom: '0.5px solid var(--color-border-tertiary)', padding: '6px 8px' }}>
                  {['Description', 'Qty', 'Unit', 'Amount', 'GL Account', 'Job', ''].map(h => (
                    <span key={h} style={{ fontSize: 9, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-secondary)' }}>{h}</span>
                  ))}
                </div>
                {lineItems.map((item, i) => (
                  <div
                    key={item.line_id}
                    className="grid items-center"
                    style={{
                      gridTemplateColumns: '3fr 0.6fr 0.8fr 0.9fr 1.4fr 1.2fr 24px',
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
                    onChange={e => updateBill(bill.bill_id, { payment_account_id: e.target.value || null })}
                    style={selectStyle}
                  >
                    <option value="">— Select account —</option>
                    {paymentAccounts.map(a => <option key={a.qb_account_id} value={a.qb_account_id}>{a.name}</option>)}
                  </select>
                </Field>
                <Field label="Payment Method" helper="Sets the payment type on the QB bill payment record.">
                  <select
                    defaultValue={bill.payment_method ?? ''}
                    onChange={e => updateBill(bill.bill_id, { payment_method: e.target.value || null })}
                    style={selectStyle}
                  >
                    <option value="">— Select —</option>
                    <option value="check">Check</option>
                    <option value="ach">ACH</option>
                    <option value="credit_card">Credit Card</option>
                    <option value="other">Other</option>
                  </select>
                </Field>
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
              onClick={handleReprocess}
              disabled={isPending}
              style={{
                background: 'white', color: '#991B1B',
                border: '0.5px solid #FCA5A5',
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
    </>
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
