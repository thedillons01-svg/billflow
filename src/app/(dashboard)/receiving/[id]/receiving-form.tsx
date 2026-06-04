'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { submitReceiving } from './actions'

type Line = {
  line_id: string
  description: string | null
  quantity_ordered: number | null
  quantity_received: number | null
  unit_cost: number | null
  extended_cost: number | null
  sort_order: number
}

type LineState = {
  qty: string
  note: string
  noteOpen: boolean
}

function initQty(line: Line): string {
  const prev = line.quantity_received ?? 0
  const ordered = line.quantity_ordered ?? 1
  // Default to fully received if already partially or fully received, else 0
  return prev > 0 ? String(ordered) : String(ordered)
}

function deriveStatus(qty: string, ordered: number | null): 'received' | 'partial' | 'not_received' {
  const n = parseFloat(qty) || 0
  const o = ordered ?? 1
  if (n <= 0) return 'not_received'
  if (n >= o) return 'received'
  return 'partial'
}

export function ReceivingForm({ poId, lines }: { poId: string; lines: Line[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [notes, setNotes] = useState('')
  const [lineState, setLineState] = useState<Record<string, LineState>>(
    Object.fromEntries(lines.map(l => [l.line_id, {
      qty: initQty(l),
      note: '',
      noteOpen: false,
    }]))
  )

  const receiveAll = () => {
    setLineState(prev => {
      const next = { ...prev }
      for (const l of lines) {
        next[l.line_id] = { ...next[l.line_id], qty: String(l.quantity_ordered ?? 1) }
      }
      return next
    })
  }

  const toggleLine = (id: string, ordered: number | null) => {
    const current = parseFloat(lineState[id]?.qty || '0') || 0
    const o = ordered ?? 1
    setLineState(prev => ({
      ...prev,
      [id]: { ...prev[id], qty: current > 0 ? '0' : String(o) },
    }))
  }

  const handleSubmit = () => {
    startTransition(async () => {
      const lineItems = lines.map(l => {
        const qty = parseFloat(lineState[l.line_id]?.qty || '0') || 0
        return {
          line_id: l.line_id,
          status: deriveStatus(lineState[l.line_id]?.qty ?? '0', l.quantity_ordered),
          quantity_received: Math.max(0, Math.min(qty, l.quantity_ordered ?? qty)),
          note: lineState[l.line_id]?.note ?? '',
        }
      })
      await submitReceiving({ poId, lineItems, notes })
      router.push('/receiving')
    })
  }

  const allReceived = lines.every(l => parseFloat(lineState[l.line_id]?.qty || '0') >= (l.quantity_ordered ?? 1))

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <button
          onClick={receiveAll}
          disabled={isPending || allReceived}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'white', color: '#1A3D2B',
            border: '0.5px solid #C3DEC9', borderRadius: 6,
            padding: '6px 14px', fontSize: 13, fontWeight: 500,
            cursor: isPending || allReceived ? 'default' : 'pointer',
            opacity: allReceived ? 0.5 : 1,
          }}
        >
          <i className="ti ti-checks" style={{ fontSize: 14 }} />
          Receive All
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSubmit}
            disabled={isPending}
            style={{
              background: '#2DB87A', color: 'white',
              borderRadius: 6, padding: '6px 16px',
              fontSize: 13, fontWeight: 500,
              border: 'none', cursor: isPending ? 'default' : 'pointer',
              opacity: isPending ? 0.6 : 1,
            }}
          >
            {isPending ? 'Saving…' : 'Save'}
          </button>
          <a
            href="/receiving"
            style={{
              background: 'white', color: 'var(--color-text-secondary)',
              borderRadius: 6, padding: '6px 14px', fontSize: 13,
              border: '0.5px solid var(--color-border-secondary)',
              textDecoration: 'none', display: 'inline-block',
            }}
          >
            Cancel
          </a>
        </div>
      </div>

      {/* Grid */}
      <div
        style={{
          background: 'white',
          border: '0.5px solid var(--color-border-tertiary)',
          borderRadius: 8, overflow: 'hidden',
          marginBottom: 16,
        }}
      >
        {/* Header */}
        <div
          className="grid items-center px-3 py-2"
          style={{
            gridTemplateColumns: '36px 1fr 52px 80px 32px',
            background: 'var(--color-background-secondary)',
            borderBottom: '0.5px solid var(--color-border-tertiary)',
          }}
        >
          {['', 'Description', 'Ord', 'Rcvd', ''].map((h, i) => (
            <span key={i} style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-secondary)' }}>
              {h}
            </span>
          ))}
        </div>

        {lines.map((line, idx) => {
          const state = lineState[line.line_id]
          const qty = parseFloat(state?.qty || '0') || 0
          const ordered = line.quantity_ordered ?? 1
          const checked = qty > 0
          const status = deriveStatus(state?.qty ?? '0', line.quantity_ordered)

          return (
            <div key={line.line_id} style={{ borderBottom: idx < lines.length - 1 ? '0.5px solid var(--color-border-tertiary)' : 'none' }}>
              <div
                className="grid items-center px-3"
                style={{ gridTemplateColumns: '36px 1fr 52px 80px 32px', minHeight: 48 }}
              >
                {/* Checkbox */}
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleLine(line.line_id, line.quantity_ordered)}
                  style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#2DB87A' }}
                />

                {/* Description + status badge */}
                <div style={{ paddingRight: 8, paddingTop: 4, paddingBottom: 4 }}>
                  <span style={{
                    fontSize: 13, color: checked ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                    display: 'block', lineHeight: 1.4,
                  }}>
                    {line.description ?? 'No description'}
                  </span>
                  {line.unit_cost != null && (
                    <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>
                      ${Number(line.unit_cost).toFixed(2)} each
                    </span>
                  )}
                  {status === 'partial' && (
                    <span style={{ fontSize: 10, fontWeight: 500, color: '#D97706', background: '#FEF3C7', borderRadius: 3, padding: '1px 5px', marginLeft: 4 }}>
                      partial
                    </span>
                  )}
                </div>

                {/* Ordered qty */}
                <span style={{ fontSize: 13, color: 'var(--color-text-secondary)', fontVariantNumeric: 'tabular-nums', textAlign: 'right', paddingRight: 8 }}>
                  {ordered}
                </span>

                {/* Received qty input */}
                <input
                  type="number"
                  value={state?.qty ?? ''}
                  min={0}
                  max={ordered}
                  step="1"
                  onChange={e => setLineState(prev => ({
                    ...prev,
                    [line.line_id]: { ...prev[line.line_id], qty: e.target.value },
                  }))}
                  style={{
                    width: '100%', height: 32,
                    border: `0.5px solid ${status === 'partial' ? '#FCD34D' : status === 'received' ? '#6EE7B7' : 'var(--color-border-secondary)'}`,
                    borderRadius: 5, padding: '0 8px',
                    fontSize: 13, textAlign: 'center',
                    background: status === 'received' ? '#F0FDF4' : status === 'partial' ? '#FFFBEB' : 'white',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                />

                {/* Note toggle */}
                <button
                  type="button"
                  onClick={() => setLineState(prev => ({
                    ...prev,
                    [line.line_id]: { ...prev[line.line_id], noteOpen: !prev[line.line_id].noteOpen },
                  }))}
                  title="Add note"
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: state?.note ? '#D97706' : 'var(--color-text-tertiary)',
                    fontSize: 15, padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <i className={state?.note ? 'ti ti-message-filled' : 'ti ti-message'} />
                </button>
              </div>

              {/* Inline note field */}
              {state?.noteOpen && (
                <div className="px-3 pb-3" style={{ paddingLeft: 52 }}>
                  <input
                    type="text"
                    placeholder="Damage, substitution, discrepancy…"
                    value={state.note}
                    autoFocus
                    onChange={e => setLineState(prev => ({
                      ...prev,
                      [line.line_id]: { ...prev[line.line_id], note: e.target.value },
                    }))}
                    style={{
                      width: '100%', height: 32,
                      border: '0.5px solid var(--color-border-secondary)',
                      borderRadius: 5, padding: '0 10px', fontSize: 12,
                    }}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Overall notes — compact */}
      <div className="mb-5">
        <input
          type="text"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Overall delivery notes (optional)"
          style={{
            width: '100%', height: 36,
            border: '0.5px solid var(--color-border-secondary)',
            borderRadius: 6, padding: '0 10px', fontSize: 13,
          }}
        />
      </div>
    </div>
  )
}
