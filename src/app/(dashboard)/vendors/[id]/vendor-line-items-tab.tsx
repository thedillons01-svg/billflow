'use client'

import { useState, useTransition } from 'react'
import { deleteMapping } from './actions'

type Mapping = { id: string; description_text: string; gl_account_id: string | null; created_at: string }
type Account = { qb_account_id: string; name: string | null }

export function VendorLineItemsTab({
  vendorId,
  mappings,
  accounts,
}: {
  vendorId: string
  mappings: Mapping[]
  accounts: Account[]
}) {
  const [list, setList] = useState(mappings)
  const [isPending, startTransition] = useTransition()

  const handleDelete = (id: string) => {
    startTransition(async () => {
      await deleteMapping(id)
      setList(l => l.filter(m => m.id !== id))
    })
  }

  const getAccountName = (id: string | null) => {
    if (!id) return '—'
    return accounts.find(a => a.qb_account_id === id)?.name ?? id
  }

  return (
    <div style={{ maxWidth: 700 }}>
      <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 16, lineHeight: 1.6 }}>
        When you click "Remember? Yes" on a line item GL account change in the bill review screen, Purchasomatic saves the description → GL account mapping here. On future invoices from this vendor, matching line items are automatically pre-populated with the saved account. Source badge shows "Rule."
      </p>

      {list.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <i className="ti ti-database" style={{ fontSize: 36, color: 'var(--color-text-tertiary)' }} />
          <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 12 }}>
            No saved mappings yet. They appear here when you click "Remember? Yes" on a line item in the bill review screen.
          </p>
        </div>
      ) : (
        <div style={{ background: 'white', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 8, overflow: 'hidden' }}>
          {/* Headers */}
          <div className="grid px-4 py-2" style={{ gridTemplateColumns: '2fr 1.5fr 80px', borderBottom: '0.5px solid var(--color-border-tertiary)', background: 'var(--color-background-secondary)' }}>
            {['Description text', 'GL Account', ''].map(h => (
              <span key={h} style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-secondary)' }}>{h}</span>
            ))}
          </div>
          {list.map((m, i) => (
            <div
              key={m.id}
              className="grid items-center px-4 py-3"
              style={{
                gridTemplateColumns: '2fr 1.5fr 80px',
                borderBottom: i < list.length - 1 ? '0.5px solid var(--color-border-tertiary)' : 'none',
              }}
            >
              <span style={{ fontSize: 13, color: 'var(--color-text-primary)' }}>{m.description_text}</span>
              <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{getAccountName(m.gl_account_id)}</span>
              <button
                onClick={() => handleDelete(m.id)}
                disabled={isPending}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#991B1B', fontSize: 12, padding: 0 }}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
