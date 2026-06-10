'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { JobProfitabilityRow } from '@/lib/quickbooks/profitability'
import { closeJob, reopenJob, renameJob } from './actions'

type ClosedJob = { qb_job_id: string; job_number: string | null; job_name: string | null; customer_name: string | null }

const fmt = (n: number | null) =>
  n == null ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

const fmtPct = (n: number | null) => n == null ? '—' : `${n.toFixed(1)}%`

export function JobsTable({
  rows,
  closedJobs,
  showClosed,
  companyId,
}: {
  rows: JobProfitabilityRow[]
  closedJobs: ClosedJob[]
  showClosed: boolean
  companyId: string
}) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [isPending, startTransition] = useTransition()
  const [actionId, setActionId] = useState<string | null>(null)
  const [renameId, setRenameId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [renameError, setRenameError] = useState<string | null>(null)

  const startRename = (jobId: string, currentName: string) => {
    setRenameId(jobId)
    setRenameValue(currentName)
    setRenameError(null)
  }

  const cancelRename = () => { setRenameId(null); setRenameValue(''); setRenameError(null) }

  const submitRename = (companyId: string) => {
    if (!renameId || !renameValue.trim()) return
    setRenameError(null)
    startTransition(async () => {
      const result = await renameJob(companyId, renameId, renameValue.trim())
      if ('error' in result) {
        setRenameError(result.error)
      } else {
        setRenameId(null)
        setRenameValue('')
        router.refresh()
      }
    })
  }

  const handleClose = (jobId: string) => {
    setActionId(jobId)
    startTransition(async () => {
      await closeJob(jobId)
      setActionId(null)
      router.refresh()
    })
  }

  const handleReopen = (jobId: string) => {
    setActionId(jobId)
    startTransition(async () => {
      await reopenJob(jobId)
      setActionId(null)
      router.refresh()
    })
  }

  const q = search.trim().toLowerCase()

  if (showClosed) {
    const filtered = q
      ? closedJobs.filter(j =>
          j.job_number?.toLowerCase().includes(q) ||
          j.job_name?.toLowerCase().includes(q) ||
          j.customer_name?.toLowerCase().includes(q)
        )
      : closedJobs

    return (
      <div className="space-y-4">
        <div style={{ position: 'relative', maxWidth: 360 }}>
          <i className="ti ti-search" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: 'var(--color-text-tertiary)' }} />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search job number, name, or customer…"
            style={{ width: '100%', height: 36, border: '0.5px solid var(--color-border-secondary)', borderRadius: 6, padding: '0 10px 0 32px', fontSize: 13 }} />
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <i className="ti ti-circle-check" style={{ fontSize: 40, color: 'var(--color-text-tertiary)' }} />
            <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)', marginTop: 12 }}>No closed jobs</p>
            <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 4 }}>
              {q ? 'No closed jobs match your search.' : 'Jobs you close will appear here.'}
            </p>
          </div>
        ) : (
          <div style={{ background: 'white', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 8, overflow: 'hidden' }}>
            <div className="grid px-4 py-2" style={{ gridTemplateColumns: '2fr 1.5fr 1fr', background: 'var(--color-background-secondary)', borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
              {['Job', 'Customer', ''].map(h => (
                <span key={h} style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-secondary)' }}>{h}</span>
              ))}
            </div>
            {filtered.map((job, i) => (
              <div key={job.qb_job_id} style={{
                borderBottom: i < filtered.length - 1 ? '0.5px solid var(--color-border-tertiary)' : 'none',
                background: i % 2 === 0 ? 'white' : 'var(--color-background-secondary)',
              }}>
                {renameId === job.qb_job_id ? (
                  <div className="px-4 py-3 flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={e => setRenameValue(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') submitRename(companyId); if (e.key === 'Escape') cancelRename() }}
                        style={{ flex: 1, height: 28, border: '0.5px solid var(--color-border-secondary)', borderRadius: 5, padding: '0 8px', fontSize: 13 }}
                      />
                      <button onClick={() => submitRename(companyId)} disabled={!renameValue.trim() || isPending}
                        style={{ height: 28, padding: '0 12px', fontSize: 12, fontWeight: 500, color: 'white', background: '#2DB87A', border: 'none', borderRadius: 5, cursor: 'pointer', opacity: !renameValue.trim() || isPending ? 0.6 : 1 }}
                      >{isPending ? 'Saving…' : 'Save'}</button>
                      <button onClick={cancelRename} style={{ height: 28, padding: '0 8px', fontSize: 12, color: 'var(--color-text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }}>Cancel</button>
                    </div>
                    {renameError && <p style={{ fontSize: 11, color: '#991B1B', margin: 0 }}>{renameError}</p>}
                  </div>
                ) : (
                  <div className="grid items-center px-4 py-3" style={{ gridTemplateColumns: '2fr 1.5fr 1fr' }}>
                    <div className="flex items-center gap-2">
                      <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)', margin: 0 }}>
                        {job.job_number ? `#${job.job_number}` : ''}{job.job_number && job.job_name ? ' · ' : ''}{job.job_name ?? ''}
                      </p>
                      <button onClick={() => startRename(job.qb_job_id, job.job_name ?? '')} title="Rename job"
                        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--color-text-tertiary)', lineHeight: 1, flexShrink: 0 }}>
                        <i className="ti ti-pencil" style={{ fontSize: 12 }} />
                      </button>
                    </div>
                    <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{job.customer_name ?? '—'}</span>
                    <div className="flex justify-end">
                      <button
                        onClick={() => handleReopen(job.qb_job_id)}
                        disabled={isPending && actionId === job.qb_job_id}
                        style={{
                          fontSize: 12, fontWeight: 500, color: '#2DB87A',
                          background: 'none', border: '0.5px solid #C3DEC9', borderRadius: 5,
                          padding: '4px 12px', cursor: 'pointer',
                          opacity: isPending && actionId === job.qb_job_id ? 0.5 : 1,
                        }}
                      >
                        {isPending && actionId === job.qb_job_id ? 'Reopening…' : 'Reopen'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        <p style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>
          {filtered.length} closed job{filtered.length !== 1 ? 's' : ''} · Closed jobs are hidden from all tagging dropdowns
        </p>
      </div>
    )
  }

  // Active tab
  const filtered = q
    ? rows.filter(r =>
        r.job_number?.toLowerCase().includes(q) ||
        r.job_name?.toLowerCase().includes(q) ||
        r.customer_name?.toLowerCase().includes(q)
      )
    : rows

  return (
    <div className="space-y-4">
      <div style={{ position: 'relative', maxWidth: 360 }}>
        <i className="ti ti-search" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: 'var(--color-text-tertiary)' }} />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search job number, name, or customer…"
          style={{ width: '100%', height: 36, border: '0.5px solid var(--color-border-secondary)', borderRadius: 6, padding: '0 10px 0 32px', fontSize: 13 }} />
      </div>

      <div style={{ background: 'white', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 8, overflow: 'hidden' }}>
        <div className="grid" style={{ gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr 1fr 80px', borderBottom: '0.5px solid var(--color-border-tertiary)', background: 'var(--color-background-secondary)', padding: '6px 16px' }}>
          {['Job', 'Customer', 'Revenue', 'Material Cost', 'Gross Profit', 'Margin', ''].map((h, i) => (
            <span key={h + i} style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-secondary)', textAlign: i >= 2 && i < 6 ? 'right' : 'left' }}>{h}</span>
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
            const marginColor = row.margin_pct == null ? 'var(--color-text-secondary)'
              : row.margin_pct >= 30 ? '#065F46'
              : row.margin_pct >= 10 ? '#92400E'
              : '#991B1B'
            return (
              <div key={row.qb_job_id} style={{
                borderBottom: i < filtered.length - 1 ? '0.5px solid var(--color-border-tertiary)' : 'none',
                background: i % 2 === 0 ? 'white' : 'var(--color-background-secondary)',
              }}>
                {renameId === row.qb_job_id ? (
                  <div className="px-4 py-3 flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={e => setRenameValue(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') submitRename(companyId); if (e.key === 'Escape') cancelRename() }}
                        style={{ flex: 1, height: 28, border: '0.5px solid var(--color-border-secondary)', borderRadius: 5, padding: '0 8px', fontSize: 13 }}
                      />
                      <button onClick={() => submitRename(companyId)} disabled={!renameValue.trim() || isPending}
                        style={{ height: 28, padding: '0 12px', fontSize: 12, fontWeight: 500, color: 'white', background: '#2DB87A', border: 'none', borderRadius: 5, cursor: 'pointer', opacity: !renameValue.trim() || isPending ? 0.6 : 1 }}
                      >{isPending ? 'Saving…' : 'Save'}</button>
                      <button onClick={cancelRename} style={{ height: 28, padding: '0 8px', fontSize: 12, color: 'var(--color-text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }}>Cancel</button>
                    </div>
                    {renameError && <p style={{ fontSize: 11, color: '#991B1B', margin: 0 }}>{renameError}</p>}
                  </div>
                ) : (
                  <div className="grid items-center" style={{ gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr 1fr 80px', padding: '10px 16px' }}>
                    <div className="flex items-center gap-2">
                      <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)', margin: 0 }}>
                        {row.job_number ? `#${row.job_number}` : ''}{row.job_number && row.job_name ? ' · ' : ''}{row.job_name ?? ''}
                      </p>
                      <button onClick={() => startRename(row.qb_job_id, row.job_name ?? '')} title="Rename job"
                        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--color-text-tertiary)', lineHeight: 1, flexShrink: 0 }}>
                        <i className="ti ti-pencil" style={{ fontSize: 12 }} />
                      </button>
                    </div>
                    <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{row.customer_name ?? '—'}</span>
                    <span style={{ fontSize: 13, color: 'var(--color-text-primary)', textAlign: 'right' }}>{fmt(row.revenue)}</span>
                    <span style={{ fontSize: 13, color: 'var(--color-text-primary)', textAlign: 'right' }}>{fmt(row.material_cost)}</span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)', textAlign: 'right' }}>{fmt(row.gross_profit)}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: marginColor, textAlign: 'right' }}>{fmtPct(row.margin_pct)}</span>
                    <div className="flex justify-end">
                      <button
                        onClick={() => handleClose(row.qb_job_id)}
                        disabled={isPending && actionId === row.qb_job_id}
                        title="Close this job — hides it from tagging dropdowns"
                        style={{
                          fontSize: 11, color: 'var(--color-text-secondary)',
                          background: 'none', border: '0.5px solid var(--color-border-secondary)', borderRadius: 5,
                          padding: '3px 10px', cursor: 'pointer',
                          opacity: isPending && actionId === row.qb_job_id ? 0.5 : 1,
                        }}
                      >
                        {isPending && actionId === row.qb_job_id ? '…' : 'Close'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      <p style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>
        Showing {filtered.length} of {rows.length} active jobs · Revenue from QuickBooks P&amp;L · Material costs from Purchasomatic published bills
      </p>
    </div>
  )
}
