'use client'

import { useState } from 'react'
import { recalculateAllPOJobs } from './actions'

export function RecalculateJobsButton() {
  const [state, setState] = useState<'idle' | 'running' | 'done'>('idle')
  const [result, setResult] = useState<{ updated: number; cleared: number } | null>(null)

  async function handleClick() {
    setState('running')
    try {
      const r = await recalculateAllPOJobs()
      setResult(r)
      setState('done')
    } catch {
      setState('idle')
    }
  }

  if (state === 'done' && result) {
    return (
      <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
        {result.updated} matched, {result.cleared} cleared
      </span>
    )
  }

  return (
    <button
      onClick={handleClick}
      disabled={state === 'running'}
      style={{
        fontSize: 12,
        color: 'var(--color-text-secondary)',
        background: 'none',
        border: 'none',
        cursor: state === 'running' ? 'default' : 'pointer',
        padding: 0,
        opacity: state === 'running' ? 0.5 : 1,
      }}
    >
      {state === 'running' ? 'Recalculating…' : 'Recalculate jobs'}
    </button>
  )
}
