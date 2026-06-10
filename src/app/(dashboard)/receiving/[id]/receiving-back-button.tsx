'use client'

import { useGuardedNavigate } from '@/components/unsaved-guard'

export function ReceivingBackButton() {
  const navigate = useGuardedNavigate()
  return (
    <button
      onClick={() => navigate('/receiving')}
      className="flex items-center gap-1 mb-2"
      style={{ fontSize: 12, color: 'var(--color-text-secondary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
    >
      <i className="ti ti-arrow-left" style={{ fontSize: 12 }} />
      Back to Receiving
    </button>
  )
}
