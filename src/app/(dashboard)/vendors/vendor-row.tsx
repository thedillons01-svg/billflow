'use client'

import { useTransition } from 'react'
import { updateVendor } from './actions'

type Vendor = {
  vendor_id: string
  vendor_name_extracted: string
  vendor_name_display: string | null
  invoices_processed: number
  confidence_display: string | null
  last_invoice_date: string | null
  auto_publish_enabled: boolean
  hold_for_job_match: boolean
  gl_account_source: string
  qb_default_gl_account_id: string | null
  billflow_gl_account_id: string | null
}

const CONFIDENCE_STYLES: Record<string, string> = {
  high:   'bg-green-100 text-green-700',
  medium: 'bg-amber-100 text-amber-700',
  low:    'bg-gray-100 text-gray-600',
}

const GL_SOURCE_LABEL: Record<string, string> = {
  qb_default:        'From QB',
  billflow_override:  'Override',
  not_set:           'Not set',
}

export function VendorRow({ vendor: v }: { vendor: Vendor }) {
  const [isPending, startTransition] = useTransition()

  function toggle(field: 'auto_publish_enabled' | 'hold_for_job_match', current: boolean) {
    startTransition(() => updateVendor(v.vendor_id, { [field]: !current }))
  }

  return (
    <tr className={`hover:bg-gray-50 transition-colors ${isPending ? 'opacity-60' : ''}`}>
      <td className="px-5 py-3.5">
        <p className="font-medium text-gray-900">{v.vendor_name_display ?? v.vendor_name_extracted}</p>
        {v.vendor_name_display && v.vendor_name_display !== v.vendor_name_extracted && (
          <p className="text-xs text-gray-400">OCR: {v.vendor_name_extracted}</p>
        )}
      </td>
      <td className="px-4 py-3.5 text-gray-600">{v.invoices_processed}</td>
      <td className="px-4 py-3.5">
        {v.confidence_display ? (
          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${CONFIDENCE_STYLES[v.confidence_display] ?? 'bg-gray-100 text-gray-600'}`}>
            {v.confidence_display.charAt(0).toUpperCase() + v.confidence_display.slice(1)}
          </span>
        ) : (
          <span className="text-xs text-gray-400">—</span>
        )}
      </td>
      <td className="px-4 py-3.5">
        <span className={`text-xs ${v.gl_account_source === 'not_set' ? 'text-gray-400' : 'text-gray-600'}`}>
          {GL_SOURCE_LABEL[v.gl_account_source] ?? v.gl_account_source}
        </span>
      </td>
      <td className="px-4 py-3.5">
        <Toggle
          enabled={v.auto_publish_enabled}
          onToggle={() => toggle('auto_publish_enabled', v.auto_publish_enabled)}
        />
      </td>
      <td className="px-4 py-3.5">
        <Toggle
          enabled={v.hold_for_job_match}
          onToggle={() => toggle('hold_for_job_match', v.hold_for_job_match)}
        />
      </td>
      <td className="px-4 py-3.5 text-gray-500 text-xs">
        {v.last_invoice_date
          ? new Date(v.last_invoice_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
          : '—'}
      </td>
    </tr>
  )
}

function Toggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      role="switch"
      aria-checked={enabled}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
        enabled ? 'bg-blue-600' : 'bg-gray-200'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          enabled ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
  )
}
