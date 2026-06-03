'use client'

import { useState } from 'react'

interface Props {
  credits: number
  mode: 'subscription' | 'topup'
  label?: string
  style?: React.CSSProperties
}

export function CheckoutButton({ credits, mode, label = 'Subscribe', style }: Props) {
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, credits }),
      })
      const data = await res.json() as { url?: string; error?: string }
      if (data.url) {
        window.location.href = data.url
      } else {
        alert(data.error ?? 'Failed to start checkout')
        setLoading(false)
      }
    } catch {
      alert('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      style={{
        background: '#2DB87A',
        color: 'white',
        borderRadius: 6,
        padding: '8px 20px',
        fontSize: 13,
        fontWeight: 500,
        border: 'none',
        cursor: loading ? 'not-allowed' : 'pointer',
        opacity: loading ? 0.7 : 1,
        ...style,
      }}
    >
      {loading ? 'Loading…' : label}
    </button>
  )
}

export function ManageSubscriptionButton() {
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      const data = await res.json() as { url?: string; error?: string }
      if (data.url) {
        window.location.href = data.url
      } else {
        alert(data.error ?? 'Could not open billing portal')
        setLoading(false)
      }
    } catch {
      alert('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      style={{
        background: 'white',
        color: 'var(--color-text-primary)',
        borderRadius: 6,
        padding: '7px 16px',
        fontSize: 13,
        fontWeight: 500,
        border: '0.5px solid var(--color-border-secondary)',
        cursor: loading ? 'not-allowed' : 'pointer',
        opacity: loading ? 0.7 : 1,
      }}
    >
      {loading ? 'Loading…' : 'Manage subscription'}
    </button>
  )
}
