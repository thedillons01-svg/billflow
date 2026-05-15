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

export function ReceivingForm({ poId, lines }: { poId: string; lines: Line[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [notes, setNotes] = useState('')
  const [lineState, setLineState] = useState<Record<string, { status: 'received' | 'partial' | 'not_received'; qty: string; note: string }>>(
    Object.fromEntries(lines.map(l => [l.line_id, {
      status: (l.quantity_received ?? 0) >= (l.quantity_ordered ?? 1) ? 'received' : 'not_received',
      qty: String(l.quantity_ordered ?? ''),
      note: '',
    }]))
  )

  const setLineStatus = (id: string, status: 'received' | 'partial' | 'not_received') => {
    setLineState(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        status,
        qty: status === 'received' ? String(lines.find(l => l.line_id === id)?.quantity_ordered ?? '') : prev[id].qty,
      }
    }))
  }

  const handleSubmit = () => {
    startTransition(async () => {
      const lineItems = lines.map(l => ({
        line_id: l.line_id,
        status: lineState[l.line_id]?.status ?? 'not_received',
        quantity_received: lineState[l.line_id]?.status === 'not_received'
          ? 0
          : lineState[l.line_id]?.status === 'received'
          ? (l.quantity_ordered ?? 1)
          : parseFloat(lineState[l.line_id]?.qty || '0'),
        note: lineState[l.line_id]?.note ?? '',
      }))
      await submitReceiving({ poId, lineItems, notes })
      router.push('/receiving')
    })
  }

  return (
    <div>
      <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 16 }}>
        Mark each line as received, partially received, or not received. This updates the PO status in Purchasomatic.
      </p>

      <div
        style={{
          background: 'white',
          border: '0.5px solid var(--color-border-tertiary)',
          borderRadius: 8,
          overflow: 'hidden',
          marginBottom: 20,
        }}
      >
        {lines.map((line, idx) => {
          const state = lineState[line.line_id] ?? { status: 'not_received', qty: '', note: '' }
          return (
            <div
              key={line.line_id}
              style={{
                borderBottom: idx < lines.length - 1 ? '0.5px solid var(--color-border-tertiary)' : 'none',
              }}
            >
              <div className="px-5 py-4">
                <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: 8 }}>
                  {line.description ?? 'No description'}
                </p>
                <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 12 }}>
                  Ordered: {line.quantity_ordered ?? '—'}
                  {line.unit_cost != null ? ` · $${Number(line.unit_cost).toFixed(2)} each` : ''}
                  {(line.quantity_received ?? 0) > 0 ? ` · ${line.quantity_received} previously received` : ''}
                </p>

                {/* Status buttons */}
                <div className="flex gap-2 mb-3">
                  {(['received', 'partial', 'not_received'] as const).map(s => (
                    <button
                      key={s}
                      onClick={() => setLineStatus(line.line_id, s)}
                      style={{
                        padding: '5px 12px',
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: state.status === s ? 500 : 400,
                        cursor: 'pointer',
                        border: state.status === s ? '1.5px solid #2DB87A' : '0.5px solid var(--color-border-secondary)',
                        background: state.status === s ? '#EBF5EF' : 'white',
                        color: state.status === s ? '#1A3D2B' : 'var(--color-text-secondary)',
                      }}
                    >
                      {s === 'received' ? 'Received' : s === 'partial' ? 'Partial' : 'Not Received'}
                    </button>
                  ))}
                </div>

                {state.status === 'partial' && (
                  <div className="mb-3">
                    <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>
                      Quantity received
                    </label>
                    <input
                      type="number"
                      value={state.qty}
                      min={0}
                      max={line.quantity_ordered ?? undefined}
                      step="0.01"
                      onChange={e => setLineState(prev => ({ ...prev, [line.line_id]: { ...prev[line.line_id], qty: e.target.value } }))}
                      style={{
                        width: 120, height: 36,
                        border: '0.5px solid var(--color-border-secondary)',
                        borderRadius: 6, padding: '0 10px',
                        fontSize: 13,
                      }}
                    />
                  </div>
                )}

                <div>
                  <input
                    type="text"
                    placeholder="Notes (damage, substitution…)"
                    value={state.note}
                    onChange={e => setLineState(prev => ({ ...prev, [line.line_id]: { ...prev[line.line_id], note: e.target.value } }))}
                    style={{
                      width: '100%', height: 36,
                      border: '0.5px solid var(--color-border-secondary)',
                      borderRadius: 6, padding: '0 10px',
                      fontSize: 13, color: 'var(--color-text-primary)',
                    }}
                  />
                  <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 3 }}>
                    Optional — record damage, substitutions, or discrepancies.
                  </p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Overall notes */}
      <div className="mb-5">
        <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>
          Overall receiving notes
        </label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Any general notes about this delivery…"
          rows={3}
          style={{
            width: '100%',
            border: '0.5px solid var(--color-border-secondary)',
            borderRadius: 6, padding: '8px 10px',
            fontSize: 13, resize: 'vertical',
          }}
        />
        <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 3 }}>
          Optional — recorded in the receiving history for this PO.
        </p>
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleSubmit}
          disabled={isPending}
          style={{
            background: '#2DB87A', color: 'white',
            borderRadius: 6, padding: '7px 16px',
            fontSize: 13, fontWeight: 500,
            border: 'none', cursor: 'pointer',
            opacity: isPending ? 0.6 : 1,
          }}
        >
          {isPending ? 'Saving…' : 'Save Receiving Record'}
        </button>
        <a
          href="/receiving"
          style={{
            background: 'white', color: 'var(--color-text-primary)',
            borderRadius: 6, padding: '7px 16px',
            fontSize: 13, border: '0.5px solid var(--color-border-secondary)',
            textDecoration: 'none', display: 'inline-block',
          }}
        >
          Cancel
        </a>
      </div>
    </div>
  )
}
