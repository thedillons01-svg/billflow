'use client'

import { useState, useTransition } from 'react'
import { recordExport } from './actions'

type Option = { id: string; label: string }

export function ExportForm({
  vendors,
  jobs,
  lastExportDate,
}: {
  vendors: Option[]
  jobs: Option[]
  lastExportDate?: string | null
}) {
  const [format, setFormat] = useState<'excel' | 'pdf'>('excel')
  const [dateStart, setDateStart] = useState(lastExportDate ? lastExportDate.slice(0, 10) : '')
  const [dateEnd, setDateEnd] = useState('')
  const [selectedVendors, setSelectedVendors] = useState<string[]>([])
  const [selectedJobs, setSelectedJobs] = useState<string[]>([])
  const [isPending, startTransition] = useTransition()

  const toggleItem = (id: string, list: string[], setList: (v: string[]) => void) => {
    setList(list.includes(id) ? list.filter(x => x !== id) : [...list, id])
  }

  const handleExport = () => {
    startTransition(async () => {
      const params = new URLSearchParams({ format })
      if (dateStart) params.set('dateStart', dateStart)
      if (dateEnd) params.set('dateEnd', dateEnd)
      if (selectedVendors.length) params.set('vendorIds', selectedVendors.join(','))
      if (selectedJobs.length) params.set('jobIds', selectedJobs.join(','))

      const res = await fetch(`/api/exports/generate?${params}`)
      if (!res.ok) {
        alert('Export failed. Please try again.')
        return
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `materials-entry-${new Date().toISOString().slice(0, 10)}.${format === 'excel' ? 'xlsx' : 'pdf'}`
      a.click()
      URL.revokeObjectURL(url)

      await recordExport({
        format,
        dateStart: dateStart || null,
        dateEnd: dateEnd || null,
        vendorIds: selectedVendors,
        jobIds: selectedJobs,
        billIds: [],
      })
    })
  }

  const inputStyle = {
    height: 36,
    border: '0.5px solid var(--color-border-secondary)',
    borderRadius: 6,
    padding: '0 10px',
    fontSize: 13,
    color: 'var(--color-text-primary)',
    background: 'white',
  }

  return (
    <div
      style={{
        background: 'white',
        border: '0.5px solid var(--color-border-tertiary)',
        borderRadius: 8,
        overflow: 'hidden',
      }}
    >
      <div className="px-5 py-4" style={{ borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
        <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)' }}>Export Options</p>
        <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>
          Filter by date range, vendor, or job. Leave blank to export everything.
        </p>
      </div>

      <div className="px-5 py-4 space-y-4">
        {/* Date range */}
        <div>
          <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 6 }}>
            Invoice Date Range
          </p>
          <div className="flex items-center gap-2">
            <input type="date" value={dateStart} onChange={e => setDateStart(e.target.value)} style={inputStyle} />
            <span style={{ fontSize: 13, color: 'var(--color-text-tertiary)' }}>to</span>
            <input type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)} style={inputStyle} />
            {(dateStart || dateEnd) && (
              <button
                onClick={() => { setDateStart(''); setDateEnd('') }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--color-text-tertiary)' }}
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Vendor filter */}
        {vendors.length > 0 && (
          <div>
            <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 6 }}>
              Filter by Vendor <span style={{ fontWeight: 400, color: 'var(--color-text-tertiary)' }}>(all if none selected)</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {vendors.map(v => {
                const active = selectedVendors.includes(v.id)
                return (
                  <button
                    key={v.id}
                    onClick={() => toggleItem(v.id, selectedVendors, setSelectedVendors)}
                    style={{
                      borderRadius: 100, padding: '3px 10px', fontSize: 11, fontWeight: 500,
                      border: active ? '1.5px solid #2DB87A' : '0.5px solid var(--color-border-secondary)',
                      background: active ? '#EBF5EF' : 'white',
                      color: active ? '#1A3D2B' : 'var(--color-text-secondary)',
                      cursor: 'pointer',
                    }}
                  >
                    {v.label}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Job filter */}
        {jobs.length > 0 && (
          <div>
            <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 6 }}>
              Filter by Job <span style={{ fontWeight: 400, color: 'var(--color-text-tertiary)' }}>(all if none selected)</span>
            </p>
            <div className="flex flex-wrap gap-2" style={{ maxHeight: 120, overflowY: 'auto' }}>
              {jobs.map(j => {
                const active = selectedJobs.includes(j.id)
                return (
                  <button
                    key={j.id}
                    onClick={() => toggleItem(j.id, selectedJobs, setSelectedJobs)}
                    style={{
                      borderRadius: 100, padding: '3px 10px', fontSize: 11, fontWeight: 500,
                      border: active ? '1.5px solid #2DB87A' : '0.5px solid var(--color-border-secondary)',
                      background: active ? '#EBF5EF' : 'white',
                      color: active ? '#1A3D2B' : 'var(--color-text-secondary)',
                      cursor: 'pointer',
                    }}
                  >
                    {j.label}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Format + export button */}
        <div
          className="flex items-center justify-between pt-3"
          style={{ borderTop: '0.5px solid var(--color-border-tertiary)' }}
        >
          <div className="flex items-center gap-1 p-0.5" style={{ border: '0.5px solid var(--color-border-secondary)', borderRadius: 6, background: 'var(--color-background-secondary)' }}>
            {(['excel', 'pdf'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFormat(f)}
                style={{
                  borderRadius: 4, padding: '5px 14px', fontSize: 12, fontWeight: 500, cursor: 'pointer',
                  border: 'none',
                  background: format === f ? 'white' : 'transparent',
                  color: format === f ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                  boxShadow: format === f ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                }}
              >
                {f === 'excel' ? 'Excel (.xlsx)' : 'PDF'}
              </button>
            ))}
          </div>

          <button
            onClick={handleExport}
            disabled={isPending}
            style={{
              background: '#2DB87A', color: 'white',
              borderRadius: 6, padding: '7px 20px',
              fontSize: 13, fontWeight: 500,
              border: 'none', cursor: isPending ? 'not-allowed' : 'pointer',
              opacity: isPending ? 0.6 : 1,
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <i className="ti ti-download" style={{ fontSize: 14 }} />
            {isPending ? 'Generating…' : 'Export'}
          </button>
        </div>
      </div>
    </div>
  )
}
