'use client'

import { useFormStatus } from 'react-dom'

export function SyncButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      style={{
        background: 'white',
        color: pending ? 'var(--color-text-tertiary)' : 'var(--color-text-primary)',
        border: '0.5px solid var(--color-border-secondary)',
        borderRadius: 6, padding: '7px 16px',
        fontSize: 13, cursor: pending ? 'default' : 'pointer',
        display: 'flex', alignItems: 'center', gap: 6,
        opacity: pending ? 0.7 : 1,
      }}
    >
      <i
        className="ti ti-refresh"
        style={{
          fontSize: 13,
          display: 'inline-block',
          animation: pending ? 'spin 0.8s linear infinite' : 'none',
        }}
      />
      {pending ? 'Syncing…' : 'Sync Now'}
    </button>
  )
}
