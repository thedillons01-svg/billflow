'use client'

import { useState, useTransition } from 'react'
import { recordExport } from './actions'

type Option = { id: string; label: string }

export function ExportForm({
  vendors,
  jobs,
}: {
  vendors: Option[]
  jobs: Option[]
}) {
  const [format, setFormat] = useState<'excel' | 'pdf'>('excel')
  const [dateStart, setDateStart] = useState('')
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

  return (
    <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="px-6 py-5 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-900">Export Options</h2>
      </div>

      <div className="px-6 py-5 space-y-5">
        {/* Date range */}
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
            Invoice Date Range
          </label>
          <div className="flex items-center gap-3">
            <input
              type="date"
              value={dateStart}
              onChange={e => setDateStart(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-400">to</span>
            <input
              type="date"
              value={dateEnd}
              onChange={e => setDateEnd(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {(dateStart || dateEnd) && (
              <button
                onClick={() => { setDateStart(''); setDateEnd('') }}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Vendor filter */}
        {vendors.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
              Filter by Vendor{' '}
              <span className="normal-case text-gray-400">(all if none selected)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {vendors.map(v => (
                <button
                  key={v.id}
                  onClick={() => toggleItem(v.id, selectedVendors, setSelectedVendors)}
                  className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                    selectedVendors.includes(v.id)
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                  }`}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Job filter */}
        {jobs.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
              Filter by Job{' '}
              <span className="normal-case text-gray-400">(all if none selected)</span>
            </label>
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
              {jobs.map(j => (
                <button
                  key={j.id}
                  onClick={() => toggleItem(j.id, selectedJobs, setSelectedJobs)}
                  className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                    selectedJobs.includes(j.id)
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                  }`}
                >
                  {j.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Format + export button */}
        <div className="flex items-center justify-between border-t border-gray-100 pt-4">
          <div className="flex items-center gap-1 rounded-lg border border-gray-200 p-0.5">
            {(['excel', 'pdf'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFormat(f)}
                className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                  format === f
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {f === 'excel' ? 'Excel (.xlsx)' : 'PDF'}
              </button>
            ))}
          </div>

          <button
            onClick={handleExport}
            disabled={isPending}
            className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {isPending ? 'Generating…' : 'Export'}
          </button>
        </div>
      </div>
    </section>
  )
}
