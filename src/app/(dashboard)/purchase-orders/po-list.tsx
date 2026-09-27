'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { softDeletePO, bulkPublishPOs } from './actions'
import { formatDateOnly } from '@/lib/utils/date'
import { JobFilterInput, ProductFilterInput, jobOptionsFor, matchPoFilters, type FilterableLine } from '@/components/po-filters'

type PO = {
  po_id: string
  vendor_name_raw: string | null
  vendors?: { vendor_name_display: string | null } | null
  po_number: string | null
  order_date: string | null
  job_id: string | null
  status: string
  qb_po_id: string | null
  qb_sync_error: string | null
  po_line_items: FilterableLine[] | null
}

const STATUS_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  open:               { bg: '#D1FAE5', color: '#065F46', label: 'Open' },
  partially_received: { bg: '#FEF3C7', color: '#92400E', label: 'Partially Received' },
  received:           { bg: '#DBEAFE', color: '#1E40AF', label: 'Received' },
  closed:             { bg: '#F3F4F6', color: '#374151', label: 'Closed' },
}

const COLS = '24px minmax(0,1.2fr) minmax(0,0.8fr) minmax(0,0.8fr) minmax(0,0.6fr) minmax(0,1.1fr) 80px'

export function PoList({
  pos,
  jobMap,
  matchedBillMap,
  initialProduct = '',
  initialJob = '',
}: {
  pos: PO[]
  jobMap: Map<string, string>
  matchedBillMap?: Map<string, { bill_id: string; invoice_number: string | null }>
  initialProduct?: string
  initialJob?: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [isPending, startTransition] = useTransition()
  const [isPublishing, setIsPublishing] = useState(false)
  const [bulkMessage, setBulkMessage] = useState<string | null>(null)
  const [bulkErrors, setBulkErrors] = useState<{ poId: string; poNumber: string | null; reason: string }[]>([])
  const [productFilter, setProductFilter] = useState(initialProduct)
  const [jobFilter, setJobFilter] = useState(initialJob)

  // Don't let bulk actions reach POs the filters have hidden.
  useEffect(() => { setSelected(new Set()) }, [productFilter, jobFilter])

  // Mirror filters into the URL (debounced) so the status tabs carry them along.
  useEffect(() => {
    const t = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString())
      for (const [key, val] of [['product', productFilter], ['job', jobFilter]] as const) {
        if (val.trim()) params.set(key, val); else params.delete(key)
      }
      if (params.toString() !== searchParams.toString()) {
        router.replace(`${pathname}?${params}`, { scroll: false })
      }
    }, 400)
    return () => clearTimeout(t)
  }, [productFilter, jobFilter, pathname, router, searchParams])

  const withLines = useMemo(() => pos.map(p => ({ ...p, lines: p.po_line_items ?? [] })), [pos])
  const jobOptions = useMemo(() => jobOptionsFor(withLines, jobMap), [withLines, jobMap])

  // Line descriptions matched by the product filter, shown under the PO # so you can see why it matched.
  const matchedLinesByPo = new Map<string, string[]>()
  const visible = withLines.filter(po => {
    const { match, matchedLineIds } = matchPoFilters(po, { product: productFilter, job: jobFilter }, jobMap)
    if (match && matchedLineIds.size > 0) {
      matchedLinesByPo.set(po.po_id, po.lines.filter(l => matchedLineIds.has(l.line_id)).map(l => l.description ?? ''))
    }
    return match
  })
  const anyFilter = productFilter.trim() || jobFilter.trim()

  const allSelected = visible.length > 0 && visible.every(p => selected.has(p.po_id))
  const someSelected = selected.size > 0

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(visible.map(p => p.po_id)))
  }

  function toggleOne(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function handleBulkDelete() {
    if (!confirm(`Delete ${selected.size} PO${selected.size !== 1 ? 's' : ''}? They will be removed from the list.`)) return
    startTransition(async () => {
      for (const id of selected) await softDeletePO(id)
      setSelected(new Set())
      router.refresh()
    })
  }

  async function handleBulkPublish() {
    const ids = Array.from(selected)
    setIsPublishing(true)
    setSelected(new Set())
    setBulkMessage(`Publishing ${ids.length} PO${ids.length !== 1 ? 's' : ''}…`)
    setBulkErrors([])
    try {
      const result = await bulkPublishPOs(ids)
      setBulkErrors(result.errors)
      setBulkMessage(
        result.success === ids.length
          ? `Published ${result.success} PO${result.success !== 1 ? 's' : ''} to QuickBooks.`
          : result.success === 0
            ? `All ${ids.length} PO${ids.length !== 1 ? 's' : ''} failed to publish.`
            : `Published ${result.success} of ${ids.length} POs. ${result.failed} failed.`
      )
      if (result.errors.length === 0) router.refresh()
    } catch (err) {
      setBulkMessage('Something went wrong — please try again.')
      setBulkErrors(ids.map(id => ({ poId: id, poNumber: null, reason: err instanceof Error ? err.message : 'Unexpected error' })))
    } finally {
      setIsPublishing(false)
    }
  }

  return (
    <>
      {/* Filter bar */}
      <div
        className="flex flex-wrap items-center gap-3 px-5 py-3"
        style={{ borderBottom: '0.5px solid var(--color-border-tertiary)' }}
      >
        <ProductFilterInput value={productFilter} onChange={setProductFilter} />
        <JobFilterInput value={jobFilter} onChange={setJobFilter} options={jobOptions} listId="po-job-options" />
        {anyFilter && (
          <button
            onClick={() => { setProductFilter(''); setJobFilter('') }}
            style={{ fontSize: 12, color: 'var(--color-text-secondary)', background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            Clear
          </button>
        )}
        <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
          {visible.length} of {pos.length}
        </span>
      </div>

      {/* Bulk action bar */}
      {someSelected && (
        <div
          className="flex items-center gap-3 px-5 py-2"
          style={{ background: '#EBF5EF', borderBottom: '0.5px solid #C3DEC9', position: 'sticky', top: 0, zIndex: 10 }}
        >
          <span style={{ fontSize: 12, fontWeight: 500, color: '#1A3D2B' }}>{selected.size} selected</span>
          <div className="flex items-center gap-2 ml-2">
            <BulkButton onClick={handleBulkPublish} disabled={isPending || isPublishing} label={isPublishing ? 'Publishing…' : 'Publish to QB'} primary />
            <BulkButton onClick={handleBulkDelete} disabled={isPending} label="Delete" danger />
          </div>
          <button
            onClick={() => setSelected(new Set())}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#64748B' }}
          >
            Clear selection
          </button>
        </div>
      )}

      {/* Bulk result message */}
      {bulkMessage && (
        <div style={{
          background: bulkErrors.length > 0 ? '#FEF2F2' : '#D1FAE5',
          borderBottom: `0.5px solid ${bulkErrors.length > 0 ? '#FECACA' : '#6EE7B7'}`,
          position: 'sticky', top: 0, zIndex: 10,
        }}>
          <div className="flex items-center justify-between px-5 py-2">
            <span style={{ fontSize: 12, color: bulkErrors.length > 0 ? '#991B1B' : '#065F46' }}>{bulkMessage}</span>
            <button
              onClick={() => { const had = bulkErrors.length > 0; setBulkMessage(null); setBulkErrors([]); if (had) router.refresh() }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: bulkErrors.length > 0 ? '#991B1B' : '#065F46' }}
            >✕</button>
          </div>
          {bulkErrors.length > 0 && (
            <div className="px-5 pb-3 flex flex-col gap-1">
              {bulkErrors.map(e => (
                <div key={e.poId} className="flex items-baseline gap-2">
                  <i className="ti ti-arrow-right" style={{ fontSize: 10, color: '#DC2626', flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: '#991B1B' }}>
                    <Link href={`/purchase-orders/${e.poId}`} style={{ fontWeight: 500, color: '#DC2626' }}>
                      {e.poNumber ?? 'PO'}
                    </Link>
                    {' — '}{e.reason}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Column headers */}
      <div
        className="grid items-center px-5 py-2"
        style={{ gridTemplateColumns: COLS, borderBottom: '0.5px solid var(--color-border-tertiary)' }}
      >
        <input
          type="checkbox"
          checked={allSelected}
          onChange={toggleAll}
          style={{ cursor: 'pointer', width: 14, height: 14 }}
        />
        {['Vendor', 'PO #', 'Invoice', 'Date', 'Job', 'Status'].map(h => (
          <span key={h} style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-secondary)' }}>
            {h}
          </span>
        ))}
      </div>

      {/* Rows */}
      {visible.length === 0 && (
        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', textAlign: 'center', padding: '48px 20px' }}>
          No purchase orders match your filters.
        </p>
      )}
      {visible.map((po, i) => {
        const badge = STATUS_BADGE[po.status] ?? STATUS_BADGE.open
        const vendorDisplay = (po.vendors as { vendor_name_display: string | null } | null)?.vendor_name_display ?? po.vendor_name_raw ?? '—'
        const isChecked = selected.has(po.po_id)

        const matchedBill = matchedBillMap?.get(po.po_id)
        const matchedLines = matchedLinesByPo.get(po.po_id)

        return (
          <div
            key={po.po_id}
            className="grid items-center px-5 py-[10px]"
            style={{
              gridTemplateColumns: COLS,
              borderBottom: '0.5px solid var(--color-border-tertiary)',
              background: isChecked ? '#EBF5EF' : i % 2 === 0 ? 'white' : 'var(--color-background-secondary)',
            }}
          >
            <input
              type="checkbox"
              checked={isChecked}
              onChange={() => toggleOne(po.po_id)}
              onClick={e => e.stopPropagation()}
              style={{ cursor: 'pointer', width: 14, height: 14 }}
            />

            <Link href={`/purchase-orders/${po.po_id}`} style={{ textDecoration: 'none' }}>
              <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>{vendorDisplay}</p>
              {po.qb_sync_error && (
                <p style={{ fontSize: 11, color: '#DC2626', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}
                  title={po.qb_sync_error}>
                  {po.qb_sync_error.replace(/\{.*/, '').trim() || 'Sync error — click to view'}
                </p>
              )}
            </Link>

            <Link href={`/purchase-orders/${po.po_id}`} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ minWidth: 0, overflow: 'hidden' }}>
                <span style={{ fontSize: 13, color: 'var(--color-text-primary)' }}>{po.po_number ?? '—'}</span>
                {matchedLines && (
                  <span style={{ display: 'block', fontSize: 11, color: '#1A3D2B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    title={matchedLines.join('\n')}>
                    <i className="ti ti-box" style={{ fontSize: 10, marginRight: 3 }} />
                    {matchedLines[0]}{matchedLines.length > 1 ? ` +${matchedLines.length - 1} more` : ''}
                  </span>
                )}
              </span>
              {po.qb_po_id && (
                <span style={{ fontSize: 10, color: '#059669', display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                  <i className="ti ti-circle-check" style={{ fontSize: 10 }} />
                  In QB
                </span>
              )}
            </Link>

            {matchedBill ? (
              <Link href={`/bills/${matchedBill.bill_id}`} style={{ textDecoration: 'none' }} onClick={e => e.stopPropagation()}>
                <span style={{ fontSize: 13, color: '#2DB87A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                  {matchedBill.invoice_number ?? 'Matched'}
                </span>
              </Link>
            ) : (
              <Link href={`/purchase-orders/${po.po_id}`} style={{ textDecoration: 'none' }}>
                <span style={{ fontSize: 13, color: 'var(--color-text-tertiary)' }}>—</span>
              </Link>
            )}

            <Link href={`/purchase-orders/${po.po_id}`} style={{ textDecoration: 'none' }}>
              <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                {formatDateOnly(po.order_date)}
              </span>
            </Link>

            <Link href={`/purchase-orders/${po.po_id}`} style={{ textDecoration: 'none' }}>
              <span style={{ fontSize: 13, color: 'var(--color-text-secondary)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                title={po.job_id ? (jobMap.get(po.job_id) ?? po.job_id) : undefined}>
                {po.job_id ? (jobMap.get(po.job_id) ?? po.job_id) : '—'}
              </span>
            </Link>

            <Link href={`/purchase-orders/${po.po_id}`} style={{ textDecoration: 'none' }}>
              <span style={{ display: 'inline-block', background: badge.bg, color: badge.color, borderRadius: 4, padding: '3px 8px', fontSize: 10, fontWeight: 500 }}>
                {badge.label}
              </span>
            </Link>
          </div>
        )
      })}
    </>
  )
}

function BulkButton({ onClick, disabled, label, primary, danger }: {
  onClick: () => void; disabled: boolean; label: string; primary?: boolean; danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: primary ? '#2DB87A' : 'white',
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
