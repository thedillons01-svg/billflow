'use client'

import Link from 'next/link'
import { useState } from 'react'

type PO = {
  po_id: string
  vendor_name_raw: string | null
  vendor_name_display: string | null
  po_number: string | null
  order_date: string | null
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
  }[]
}

export function ReceivingList({ pos, jobMap }: { pos: PO[]; jobMap: Map<string, string> }) {
  const [vendorFilter, setVendorFilter] = useState('')
  const [poFilter, setPoFilter]         = useState('')
  const [expanded, setExpanded]         = useState<Set<string>>(new Set())

  const toggle = (id: string) =>
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const filtered = pos.filter(po => {
    const vendorName = (po.vendor_name_display ?? po.vendor_name_raw ?? '').toLowerCase()
    const poNum      = (po.po_number ?? '').toLowerCase()
    if (vendorFilter && !vendorName.includes(vendorFilter.toLowerCase())) return false
    if (poFilter      && !poNum.includes(poFilter.toLowerCase()))          return false
    return true
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
      <div className="flex items-center gap-3 mb-4">
        <div style={{ position: 'relative', flex: 1 }}>
          <i className="ti ti-search" style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: 'var(--color-text-tertiary)', pointerEvents: 'none' }} />
          <input
            type="text"
            value={vendorFilter}
            onChange={e => setVendorFilter(e.target.value)}
            placeholder="Filter by vendor…"
            style={{
              width: '100%', height: 34, boxSizing: 'border-box',
              border: '0.5px solid var(--color-border-secondary)', borderRadius: 7,
              padding: '0 10px 0 30px', fontSize: 13, outline: 'none', background: 'white',
            }}
          />
        </div>
        <div style={{ position: 'relative', flex: 1 }}>
          <i className="ti ti-file-text" style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: 'var(--color-text-tertiary)', pointerEvents: 'none' }} />
          <input
            type="text"
            value={poFilter}
            onChange={e => setPoFilter(e.target.value)}
            placeholder="Filter by PO #…"
            style={{
              width: '100%', height: 34, boxSizing: 'border-box',
              border: '0.5px solid var(--color-border-secondary)', borderRadius: 7,
              padding: '0 10px 0 30px', fontSize: 13, outline: 'none', background: 'white',
            }}
          />
        </div>
        {(vendorFilter || poFilter) && (
          <button
            onClick={() => { setVendorFilter(''); setPoFilter('') }}
            style={{ fontSize: 12, color: 'var(--color-text-secondary)', background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            Clear
          </button>
        )}
        <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
          {filtered.length} of {pos.length}
        </span>
      </div>

      {filtered.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', textAlign: 'center', paddingTop: 48 }}>
          No purchase orders match your filters.
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map(po => {
            const vendorName = po.vendor_name_display ?? po.vendor_name_raw ?? 'Unknown vendor'
            const isOpen = expanded.has(po.po_id)
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
                      {po.order_date ? `Ordered ${new Date(po.order_date).toLocaleDateString()}` : ''}
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
