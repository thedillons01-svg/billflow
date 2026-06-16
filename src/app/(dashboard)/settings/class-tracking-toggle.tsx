'use client'

import { useState } from 'react'

export function ClassTrackingToggle({ defaultChecked }: { defaultChecked: boolean }) {
  const [checked, setChecked] = useState(defaultChecked)

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>Class tracking enabled</p>
          <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>
            When on, a Class field appears on each bill line item for QB class tracking. Only enable if you use class tracking in QuickBooks. Default: off.
          </p>
        </div>
        <label className="relative" style={{ width: 36, height: 20, flexShrink: 0, marginTop: 2, cursor: 'pointer' }}>
          <input
            type="checkbox"
            name="class_tracking_enabled"
            checked={checked}
            onChange={e => setChecked(e.target.checked)}
            className="toggle-input sr-only"
          />
          <div className="toggle-track" />
          <div className="toggle-thumb" />
        </label>
      </div>
      {checked && (
        <a
          href="/settings/classes"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '10px 14px',
            background: '#EBF5EF',
            border: '1px solid #2DB87A',
            borderRadius: 6,
            textDecoration: 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <i className="ti ti-tag" style={{ fontSize: 16, color: '#2DB87A', flexShrink: 0 }} />
            <div>
              <p style={{ fontSize: 13, fontWeight: 500, color: '#1A3D2B', margin: 0 }}>Configure class assignments</p>
              <p style={{ fontSize: 11, color: '#5A8C6A', margin: 0, marginTop: 1 }}>Assign classes to vendors or customers so bills are coded automatically.</p>
            </div>
          </div>
          <i className="ti ti-arrow-right" style={{ fontSize: 14, color: '#2DB87A', flexShrink: 0 }} />
        </a>
      )}
    </>
  )
}
