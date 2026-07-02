'use client'
import { useState } from 'react'

export function ImpersonateButton({ email }: { email: string }) {
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle')

  async function handleClick() {
    setState('loading')
    try {
      const res = await fetch(`/api/admin/impersonate?email=${encodeURIComponent(email)}`)
      const json = await res.json()
      if (!json.otp) throw new Error('No OTP')
      const url = `/admin/switch?email=${encodeURIComponent(json.email)}&otp=${encodeURIComponent(json.otp)}`
      window.open(url, '_blank')
      setState('idle')
    } catch {
      setState('error')
      setTimeout(() => setState('idle'), 3000)
    }
  }

  const label = state === 'loading' ? '...' : state === 'error' ? 'Error' : 'Login as ↗'
  const color = state === 'error' ? '#ef4444' : '#6b7280'

  return (
    <button
      onClick={handleClick}
      disabled={state === 'loading'}
      style={{ fontSize: 12, color, border: `1px solid ${color}`, padding: '4px 10px', borderRadius: 4, background: 'white', cursor: 'pointer', whiteSpace: 'nowrap' }}
    >
      {label}
    </button>
  )
}
