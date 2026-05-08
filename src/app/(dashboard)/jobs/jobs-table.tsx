'use client'

import { useState } from 'react'
import type { JobProfitabilityRow } from '@/lib/quickbooks/profitability'

const fmt = (n: number | null, style: 'currency' | 'percent' = 'currency') => {
  if (n == null) return <span className="text-gray-300">—</span>
  if (style === 'percent') {
    return (
      <span className={n >= 0 ? 'text-green-600' : 'text-red-600'}>
        {n.toFixed(1)}%
      </span>
    )
  }
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

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
      <div className="relative max-w-sm">
        <SearchIcon />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search job number, name, or customer…"
          className="w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Table */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wide">
              <th className="px-5 py-3 text-left">Job</th>
              <th className="px-4 py-3 text-left">Customer</th>
              <th className="px-4 py-3 text-right">Revenue</th>
              <th className="px-4 py-3 text-right">Material Cost</th>
              <th className="px-4 py-3 text-right">Gross Profit</th>
              <th className="px-4 py-3 text-right">Margin</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-sm text-gray-400">
                  {search ? 'No jobs match your search.' : 'No jobs with recent activity.'}
                </td>
              </tr>
            ) : (
              filtered.map(row => (
                <tr key={row.qb_job_id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3">
                    <div className="font-medium text-gray-900">
                      {row.job_number ? `#${row.job_number}` : ''}
                      {row.job_number && row.job_name ? ' · ' : ''}
                      {row.job_name ?? ''}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{row.customer_name ?? '—'}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-900">{fmt(row.revenue)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-900">{fmt(row.material_cost)}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium">{fmt(row.gross_profit)}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium">{fmt(row.margin_pct, 'percent')}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400">
        Showing {filtered.length} of {rows.length} jobs · Revenue from QuickBooks P&amp;L · Material costs from BillFlow published bills
      </p>
    </div>
  )
}

function SearchIcon() {
  return (
    <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  )
}
