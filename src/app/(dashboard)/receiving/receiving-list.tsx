'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { formatDateOnly } from '@/lib/utils/date'
import { PoFilterBar, STATUS_OPTIONS, buildPickOptions, isOverdue, matchPo, useUrlFilters } from '@/components/po-filters'

type PO = {
  po_id: string
  vendor_name_raw: string | null
  vendor_name_display: string | null
  po_number: string | null
  order_date: string | null
  expected_delivery_date: string | null
  job_id: string | null
  status: string
  created_by: string | null
  ordered_by: string
  lines: {
    line_id: string
    description: string | null
    quantity_ordered: number | null
    quantity_received: number | null
    unit_cost: number | null
    job_id: string | null
  }[]
}

export function ReceivingList({ pos, jobMap }: { pos: PO[]; jobMap: Map<string, string> }) {
  const [filters, setFilters] = useUrlFilters()
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const filterable = useMemo(
    () => pos.map(po => ({ ...po, vendor: po.vendor_name_display ?? po.vendor_name_raw ?? 'Unknown vendor' })),
    [pos],
  )
  const { vendorOptions, jobOptions } = useMemo(() => buildPickOptions(filterable, jobMap), [filterable, jobMap])

  const toggle = (id: string) =>
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  // Line ids matched by the product filter, per PO — those POs auto-expand with the lines highlighted.
  const matchedLinesByPo = new Map<string, Set<string>>()
  const filtered = filterable.filter(po => {
    const { match, matchedLineIds } = matchPo(po, filters)
    if (match && matchedLineIds.size > 0) matchedLinesByPo.set(po.po_id, matchedLineIds)
    return match
  })

  if (pos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <i className="ti ti-package" style={{ fontSize: 48, color: 'var(--color-text-tertiary)' }} />
        <h2 style={{ fontSize: 16, fontWeight: 500, color: 'var(--color-text-primary)', marginTop: 16 }}>No open purchase orders</h2>
        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 6, maxWidth: 380 }}>
          When materials arrive, open purchase orders will appear here so you can mark what was received.
        </p>
      </div>
    )
  }

  return (
    <div>
      {/* Filter bar */}
      <div className="mb-4">
        <PoFilterBar
          fields={['vendor', 'product', 'delivery', 'status', 'job', 'po']}
          filters={filters}
          onChange={setFilters}
          vendorOptions={vendorOptions}
          jobOptions={jobOptions}
          statusOptions={STATUS_OPTIONS.filter(o => o.value === 'open' || o.value === 'partially_received')}
          count={filtered.length}
          total={pos.length}
        />
      </div>

      {filtered.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', textAlign: 'center', paddingTop: 48 }}>
          No purchase orders match your filters.
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map(po => {
            const vendorName = po.vendor
            const overdue = isOverdue(po.expected_delivery_date, po.status)
            const matchedLines = matchedLinesByPo.get(po.po_id)
            // Product matches open by default; clicking still toggles.
            const isOpen = matchedLines ? !expanded.has(po.po_id) : expanded.has(po.po_id)
            const jobLabel = po.job_id ? (jobMap.get(po.job_id) ?? po.job_id) : null

            return (
              <div
                key={po.po_id}
                style={{ background: 'white', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 8, overflow: 'hidden' }}
              >
                {/* PO header — click to expand/collapse line items */}
                <button
                  type="button"
                  onClick={() => toggle(po.po_id)}
                  className="w-full flex items-center justify-between px-5 py-3 text-left"
                  style={{ borderBottom: isOpen ? '0.5px solid var(--color-border-tertiary)' : 'none', background: 'none', cursor: 'pointer' }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)' }}>
                      {vendorName}
                      {po.po_number && (
                        <span style={{ fontWeight: 400, color: 'var(--color-text-secondary)', marginLeft: 8 }}>
                          PO #{po.po_number}
                        </span>
                      )}
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>
                      {po.order_date ? `Ordered ${formatDateOnly(po.order_date)}` : ''}
                      {po.expected_delivery_date && (
                        <span style={{ color: overdue ? '#B91C1C' : undefined, fontWeight: overdue ? 500 : undefined }}>
                          {` · Expected ${formatDateOnly(po.expected_delivery_date)}`}
                        </span>
                      )}
                      {jobLabel ? ` · ${jobLabel}` : ''}
                      {po.ordered_by ? ` · ${po.ordered_by}` : ''}
                      {' · '}
                      <span style={{ color: 'var(--color-text-tertiary)' }}>
                        {po.lines.length} line{po.lines.length !== 1 ? 's' : ''}
                        {isOpen ? ' — click to collapse' : ' — click to expand'}
                      </span>
                    </p>
                  </div>
                  <div className="flex items-center gap-3 ml-4 flex-shrink-0">
                    {overdue && (
                      <span style={{ background: '#FEE2E2', color: '#B91C1C', borderRadius: 4, padding: '3px 8px', fontSize: 10, fontWeight: 500 }}>
                        Overdue
                      </span>
                    )}
                    <span style={{
                      background: po.status === 'partially_received' ? '#FEF3C7' : '#D1FAE5',
                      color: po.status === 'partially_received' ? '#92400E' : '#065F46',
                      borderRadius: 4, padding: '3px 8px', fontSize: 10, fontWeight: 500,
                    }}>
                      {po.status === 'partially_received' ? 'Partially Received' : 'Open'}
                    </span>
                    <i
                      className={`ti ${isOpen ? 'ti-chevron-up' : 'ti-chevron-down'}`}
                      style={{ fontSize: 14, color: 'var(--color-text-tertiary)' }}
                    />
                  </div>
                </button>

                {/* Line items — only when expanded */}
                {isOpen && (
                  <>
                    {po.lines.length > 0 ? (
                      <div>
                        <div className="grid px-5 py-2" style={{
                          gridTemplateColumns: '2fr 0.8fr 0.8fr 0.8fr 100px',
                          borderBottom: '0.5px solid var(--color-border-tertiary)',
                          background: 'var(--color-background-secondary)',
                        }}>
                          {['Description', 'Ordered', 'Received', 'Unit Cost', ''].map(h => (
                            <span key={h} style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-secondary)' }}>
                              {h}
                            </span>
                          ))}
                        </div>
                        {po.lines.map((line, idx) => {
                          const allReceived = (line.quantity_received ?? 0) >= (line.quantity_ordered ?? 0)
                          return (
                            <div key={line.line_id} className="grid items-center px-5 py-2" style={{
                              gridTemplateColumns: '2fr 0.8fr 0.8fr 0.8fr 100px',
                              borderBottom: idx < po.lines.length - 1 ? '0.5px solid var(--color-border-tertiary)' : 'none',
                              background: matchedLines?.has(line.line_id) ? '#EBF5EF' : undefined,
                            }}>
                              <span style={{ fontSize: 13, color: 'var(--color-text-primary)' }}>{line.description ?? '—'}</span>
                              <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{line.quantity_ordered ?? '—'}</span>
                              <span style={{ fontSize: 13, color: allReceived ? '#065F46' : 'var(--color-text-secondary)' }}>{line.quantity_received ?? 0}</span>
                              <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                                {line.unit_cost != null ? `$${Number(line.unit_cost).toFixed(2)}` : '—'}
                              </span>
                              <span style={{ fontSize: 11, color: allReceived ? '#065F46' : '#D97706' }}>
                                {allReceived ? 'Received' : 'Pending'}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <p className="px-5 py-3" style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>No line items.</p>
                    )}
                  </>
                )}

                {/* Receive button — always visible */}
                <div className="flex justify-end px-5 py-3" style={{ borderTop: '0.5px solid var(--color-border-tertiary)' }}>
                  <Link
                    href={`/receiving/${po.po_id}`}
                    className="inline-flex items-center gap-1.5"
                    style={{ background: '#2DB87A', color: 'white', borderRadius: 6, padding: '7px 16px', fontSize: 13, fontWeight: 500, textDecoration: 'none' }}
                  >
                    <i className="ti ti-package" style={{ fontSize: 14 }} />
                    Record Receiving
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
