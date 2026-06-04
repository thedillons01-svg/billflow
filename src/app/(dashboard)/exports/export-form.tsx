'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { recordExport } from './actions'

type Option = { id: string; label: string; status?: string }

// ── Searchable multiselect ─────────────────────────────────────────────────────

function SearchableMultiselect({
  options,
  selected,
  onChange,
  placeholder,
  showClosed,
}: {
  options: Option[]
  selected: string[]
  onChange: (ids: string[]) => void
  placeholder: string
  showClosed?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = options.filter(o => {
    if (!showClosed && o.status === 'closed') return false
    if (!query) return true
    return o.label.toLowerCase().includes(query.toLowerCase())
  })

  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id])
  }

  const selectAll = () => onChange(filtered.map(o => o.id))
  const clearAll  = () => onChange([])

  const displayLabel = selected.length === 0
    ? `All (${options.filter(o => showClosed || o.status !== 'closed').length})`
    : selected.length === 1
    ? (options.find(o => o.id === selected[0])?.label ?? '1 selected')
    : `${selected.length} selected`

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', height: 36, textAlign: 'left',
          border: '0.5px solid var(--color-border-secondary)',
          borderRadius: 6, padding: '0 28px 0 10px',
          fontSize: 13, color: selected.length ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
          background: 'white', cursor: 'pointer', position: 'relative',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {displayLabel}
        </span>
        <i className={`ti ti-chevron-${open ? 'up' : 'down'}`} style={{ fontSize: 12, color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 40, left: 0, right: 0, zIndex: 50,
          background: 'white', border: '0.5px solid var(--color-border-secondary)',
          borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          maxHeight: 240, display: 'flex', flexDirection: 'column',
        }}>
          {/* Search */}
          <div style={{ padding: '6px 8px', borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
            <input
              autoFocus
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={`Search ${placeholder.toLowerCase()}…`}
              style={{
                width: '100%', height: 28, border: '0.5px solid var(--color-border-secondary)',
                borderRadius: 4, padding: '0 8px', fontSize: 12, outline: 'none',
              }}
            />
          </div>

          {/* Select all / clear */}
          <div className="flex items-center gap-2 px-2 py-1" style={{ borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
            <button type="button" onClick={selectAll} style={{ fontSize: 11, color: '#2DB87A', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>All</button>
            <span style={{ color: 'var(--color-text-tertiary)', fontSize: 11 }}>·</span>
            <button type="button" onClick={clearAll} style={{ fontSize: 11, color: 'var(--color-text-secondary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Clear</button>
          </div>

          {/* Options */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {filtered.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--color-text-tertiary)', padding: '10px 12px' }}>No matches</p>
            ) : (
              filtered.map(o => {
                const checked = selected.includes(o.id)
                return (
                  <label
                    key={o.id}
                    className="flex items-center gap-2"
                    style={{
                      padding: '6px 10px', cursor: 'pointer', fontSize: 13,
                      color: o.status === 'closed' ? 'var(--color-text-secondary)' : 'var(--color-text-primary)',
                      background: checked ? '#F0FDF4' : 'transparent',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(o.id)}
                      style={{ width: 13, height: 13, accentColor: '#2DB87A', cursor: 'pointer', flexShrink: 0 }}
                    />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {o.label}
                      {o.status === 'closed' && <span style={{ marginLeft: 4, fontSize: 10, color: '#9CA3AF' }}>Closed</span>}
                    </span>
                  </label>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Export form ────────────────────────────────────────────────────────────────

export function ExportForm({
  vendors,
  jobs,
  lastExportDate,
}: {
  vendors: Option[]
  jobs: Option[]
  lastExportDate?: string | null
}) {
  const [format, setFormat]             = useState<'excel' | 'pdf'>('excel')
  const [dateStart, setDateStart]       = useState(lastExportDate ? lastExportDate.slice(0, 10) : '')
  const [dateEnd, setDateEnd]           = useState('')
  const [selectedVendors, setSelectedVendors] = useState<string[]>([])
  const [selectedJobs, setSelectedJobs]       = useState<string[]>([])
  const [includePOs,        setIncludePOs]       = useState(true)
  const [includeReceiving,  setIncludeReceiving] = useState(true)
  const [includeInvoiced,   setIncludeInvoiced]  = useState(true)
  const [includeClosedJobs, setIncludeClosedJobs] = useState(false)
  const [isPending, startTransition] = useTransition()

  const setQuickRange = (days: number | null) => {
    if (days === null) { setDateStart(''); setDateEnd(''); return }
    const end   = new Date()
    const start = new Date()
    start.setDate(start.getDate() - days)
    setDateStart(start.toISOString().slice(0, 10))
    setDateEnd(end.toISOString().slice(0, 10))
  }

  const handleExport = () => {
    startTransition(async () => {
      const params = new URLSearchParams({ format })
      if (dateStart) params.set('dateStart', dateStart)
      if (dateEnd)   params.set('dateEnd',   dateEnd)
      if (selectedVendors.length) params.set('vendorIds', selectedVendors.join(','))
      if (selectedJobs.length)    params.set('jobIds',    selectedJobs.join(','))
      if (!includePOs)        params.set('includePOs',       'false')
      if (!includeReceiving)  params.set('includeReceiving', 'false')
      if (!includeInvoiced)   params.set('includeInvoiced',  'false')
      if (includeClosedJobs)  params.set('includeClosedJobs','true')

      const res = await fetch(`/api/exports/generate?${params}`)
      if (!res.ok) { alert('Export failed. Please try again.'); return }

      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `materials-entry-${new Date().toISOString().slice(0, 10)}.${format === 'excel' ? 'xlsx' : 'pdf'}`
      a.click()
      URL.revokeObjectURL(url)

      await recordExport({
        format,
        dateStart: dateStart || null,
        dateEnd:   dateEnd   || null,
        vendorIds: selectedVendors,
        jobIds:    selectedJobs,
        billIds:   [],
      })
    })
  }

  const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 6 }

  return (
    <div style={{ background: 'white', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 8, overflow: 'hidden' }}>
      <div className="px-5 py-4" style={{ borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
        <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)' }}>Export Options</p>
        <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>
          Filter by date, vendor, or job. Leave filters empty to export everything.
        </p>
      </div>

      <div className="px-5 py-4 space-y-4">
        {/* Transaction types */}
        <div>
          <p style={labelStyle}>Include</p>
          <div className="flex flex-wrap gap-4">
            {([
              { key: 'pos',       label: 'Purchase Orders',   value: includePOs,      set: setIncludePOs      },
              { key: 'receiving', label: 'Receiving Records',  value: includeReceiving, set: setIncludeReceiving },
              { key: 'invoiced',  label: 'Invoiced Bills',    value: includeInvoiced,  set: setIncludeInvoiced  },
            ] as const).map(({ key, label, value, set }) => (
              <label key={key} className="flex items-center gap-2" style={{ cursor: 'pointer', fontSize: 13 }}>
                <input type="checkbox" checked={value} onChange={e => set(e.target.checked)}
                  style={{ width: 14, height: 14, accentColor: '#2DB87A', cursor: 'pointer' }} />
                {label}
              </label>
            ))}
          </div>
        </div>

        {/* Date range */}
        <div>
          <p style={labelStyle}>Date Range</p>
          <div className="flex items-center gap-2 flex-wrap">
            <input type="date" value={dateStart} onChange={e => setDateStart(e.target.value)}
              style={{ height: 36, border: '0.5px solid var(--color-border-secondary)', borderRadius: 6, padding: '0 10px', fontSize: 13, background: 'white' }} />
            <span style={{ fontSize: 13, color: 'var(--color-text-tertiary)' }}>to</span>
            <input type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)}
              style={{ height: 36, border: '0.5px solid var(--color-border-secondary)', borderRadius: 6, padding: '0 10px', fontSize: 13, background: 'white' }} />
          </div>
          <div className="flex items-center gap-1 mt-2">
            {[{ label: 'Last 30 days', days: 30 }, { label: 'Last 90 days', days: 90 }, { label: 'All time', days: null }].map(({ label, days }) => (
              <button key={label} type="button" onClick={() => setQuickRange(days)}
                style={{
                  fontSize: 11, padding: '2px 8px', borderRadius: 4, cursor: 'pointer', border: 'none',
                  background: 'var(--color-background-secondary)', color: 'var(--color-text-secondary)',
                }}>
                {label}
              </button>
            ))}
            {(dateStart || dateEnd) && (
              <button type="button" onClick={() => setQuickRange(null)}
                style={{ fontSize: 11, color: 'var(--color-text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', marginLeft: 4 }}>
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Vendor filter */}
        {vendors.length > 0 && (
          <div>
            <p style={labelStyle}>
              Vendors <span style={{ fontWeight: 400, color: 'var(--color-text-tertiary)' }}>(all if none selected)</span>
            </p>
            <SearchableMultiselect
              options={vendors}
              selected={selectedVendors}
              onChange={setSelectedVendors}
              placeholder="Vendors"
            />
          </div>
        )}

        {/* Job filter */}
        {jobs.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p style={{ ...labelStyle, marginBottom: 0 }}>
                Jobs <span style={{ fontWeight: 400, color: 'var(--color-text-tertiary)' }}>(all if none selected)</span>
              </p>
              <label className="flex items-center gap-1.5" style={{ cursor: 'pointer', fontSize: 11, color: 'var(--color-text-secondary)' }}>
                <input type="checkbox" checked={includeClosedJobs} onChange={e => setIncludeClosedJobs(e.target.checked)}
                  style={{ width: 12, height: 12, accentColor: '#2DB87A' }} />
                Include closed
              </label>
            </div>
            <SearchableMultiselect
              options={jobs}
              selected={selectedJobs}
              onChange={setSelectedJobs}
              placeholder="Jobs"
              showClosed={includeClosedJobs}
            />
          </div>
        )}

        {/* Format + export button */}
        <div className="flex items-center justify-between pt-3" style={{ borderTop: '0.5px solid var(--color-border-tertiary)' }}>
          <div className="flex items-center gap-1 p-0.5" style={{ border: '0.5px solid var(--color-border-secondary)', borderRadius: 6, background: 'var(--color-background-secondary)' }}>
            {(['excel', 'pdf'] as const).map(f => (
              <button key={f} onClick={() => setFormat(f)}
                style={{
                  borderRadius: 4, padding: '5px 14px', fontSize: 12, fontWeight: 500, cursor: 'pointer',
                  border: 'none',
                  background: format === f ? 'white' : 'transparent',
                  color: format === f ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                  boxShadow: format === f ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                }}>
                {f === 'excel' ? 'Excel (.xlsx)' : 'PDF'}
              </button>
            ))}
          </div>

          <button onClick={handleExport} disabled={isPending || (!includePOs && !includeReceiving && !includeInvoiced)}
            style={{
              background: '#2DB87A', color: 'white', borderRadius: 6, padding: '7px 20px',
              fontSize: 13, fontWeight: 500, border: 'none',
              cursor: isPending ? 'not-allowed' : 'pointer',
              opacity: isPending || (!includePOs && !includeReceiving && !includeInvoiced) ? 0.6 : 1,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
            <i className="ti ti-download" style={{ fontSize: 14 }} />
            {isPending ? 'Generating…' : 'Export'}
          </button>
        </div>
      </div>
    </div>
  )
}
