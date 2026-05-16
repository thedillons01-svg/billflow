'use client'

import { useState } from 'react'
import type { JobProfitabilityRow } from '@/lib/quickbooks/profitability'

const fmtCurrency = (n: number | null) =>
  n == null ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

const fmtPct = (n: number | null) =>
  n == null ? '—' : `${n.toFixed(1)}%`

export function JobsTable({ rows }: { rows: JobProfitabilityRow[] }) {
  const [search, setSearch] = useState('')

  const filtered = search.trim()
    ? rows.filter(r => {
        const q = search.toLowerCase()
        return (
          r.job_number?.toLowerCase().includes(q) ||
          r.job_name?.toLowerCase().includes(q) ||
          r.customer_name?.toLowerCase().includes(q)
        )
      })
    : rows

  return (
    <div className="space-y-4">
      {/* Search */}
      <div style={{ position: 'relative', maxWidth: 360 }}>
        <i className="ti ti-search" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: 'var(--color-text-tertiary)' }} />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search job number, name, or customer…"
          style={{
            width: '100%', height: 36,
            border: '0.5px solid var(--color-border-secondary)',
            borderRadius: 6, padding: '0 10px 0 32px',
            fontSize: 13, color: 'var(--color-text-primary)',
          }}
        />
      </div>

      {/* Table */}
      <div
        style={{
          background: 'white',
          border: '0.5px solid var(--color-border-tertiary)',
          borderRadius: 8,
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          className="grid"
          style={{
            gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr 1fr',
            borderBottom: '0.5px solid var(--color-border-tertiary)',
            background: 'var(--color-background-secondary)',
            padding: '6px 16px',
          }}
        >
          {['Job', 'Customer', 'Revenue', 'Material Cost', 'Gross Profit', 'Margin'].map((h, i) => (
            <span
              key={h}
              style={{
                fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em',
                color: 'var(--color-text-secondary)',
                textAlign: i >= 2 ? 'right' : 'left',
              }}
            >
              {h}
            </span>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
              {search ? 'No jobs match your search.' : 'No jobs with recent activity.'}
            </p>
          </div>
        ) : (
          filtered.map((row, i) => {
            const marginColor = row.margin_pct == null
              ? 'var(--color-text-secondary)'
              : row.margin_pct >= 30 ? '#065F46'
              : row.margin_pct >= 10 ? '#92400E'
              : '#991B1B'

            return (
              <div
                key={row.qb_job_id}
                className="grid items-center"
                style={{
                  gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr 1fr',
                  borderBottom: i < filtered.length - 1 ? '0.5px solid var(--color-border-tertiary)' : 'none',
                  padding: '10px 16px',
                  background: i % 2 === 0 ? 'white' : 'var(--color-background-secondary)',
                }}
              >
                <div>
                  <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>
                    {row.job_number ? `#${row.job_number}` : ''}
                    {row.job_number && row.job_name ? ' · ' : ''}
                    {row.job_name ?? ''}
                  </p>
                </div>
                <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                  {row.customer_name ?? '—'}
                </span>
                <span style={{ fontSize: 13, color: 'var(--color-text-primary)', textAlign: 'right' }}>
                  {fmtCurrency(row.revenue)}
                </span>
                <span style={{ fontSize: 13, color: 'var(--color-text-primary)', textAlign: 'right' }}>
                  {fmtCurrency(row.material_cost)}
                </span>
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)', textAlign: 'right' }}>
                  {fmtCurrency(row.gross_profit)}
                </span>
                <span style={{ fontSize: 13, fontWeight: 600, color: marginColor, textAlign: 'right' }}>
                  {fmtPct(row.margin_pct)}
                </span>
              </div>
            )
          })
        )}
      </div>

      <p style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>
        Showing {filtered.length} of {rows.length} jobs · Revenue from QuickBooks P&amp;L · Material costs from Purchasomatic published bills
      </p>
    </div>
  )
}
