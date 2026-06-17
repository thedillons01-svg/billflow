'use client'

import { useState, useTransition } from 'react'
import { saveVendorGLAccounts } from './actions'
import { useGuardedNavigate } from '@/components/unsaved-guard'
import { useDirty } from '@/components/unsaved-guard'
import { useEffect } from 'react'

type Vendor = {
  vendor_id: string
  vendor_name_display: string | null
  qb_default_gl_account_id: string | null
  billflow_gl_account_id: string | null
}

type Account = { qb_account_id: string; name: string | null }

export function VendorGLClient({
  vendors,
  accounts,
}: {
  vendors: Vendor[]
  accounts: Account[]
}) {
  const navigate = useGuardedNavigate()
  const { setDirty } = useDirty()
  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState('')

  const accountById = new Map(accounts.map(a => [a.qb_account_id, a.name ?? a.qb_account_id]))

  const init = () => {
    const m: Record<string, string | null> = {}
    for (const v of vendors) m[v.vendor_id] = v.billflow_gl_account_id ?? null
    return m
  }
  const [overrides, setOverrides] = useState<Record<string, string | null>>(init)
  const [saved, setSaved] = useState<Record<string, string | null>>(init)

  const isDirty = vendors.some(v => overrides[v.vendor_id] !== saved[v.vendor_id])

  useEffect(() => { setDirty(isDirty) }, [isDirty, setDirty])

  const filtered = vendors.filter(v =>
    !search || (v.vendor_name_display ?? '').toLowerCase().includes(search.toLowerCase())
  )

  function handleSave() {
    const changes = vendors
      .filter(v => overrides[v.vendor_id] !== saved[v.vendor_id])
      .map(v => ({
        vendorId: v.vendor_id,
        glAccountId: overrides[v.vendor_id] ?? null,
        hasQbDefault: !!v.qb_default_gl_account_id,
      }))

    startTransition(async () => {
      await saveVendorGLAccounts(changes)
      setSaved({ ...overrides })
      setDirty(false)
      navigate('/settings')
    })
  }

  const cellStyle: React.CSSProperties = {
    padding: '10px 14px',
    fontSize: 13,
    color: 'var(--color-text-primary)',
    display: 'flex',
    alignItems: 'center',
  }

  const selectStyle: React.CSSProperties = {
    width: '100%',
    height: 32,
    border: '0.5px solid var(--color-border-secondary)',
    borderRadius: 5,
    padding: '0 8px',
    fontSize: 12,
    color: 'var(--color-text-primary)',
    background: 'white',
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 24px' }}>
      <div style={{ marginBottom: 4 }}>
        <button
          onClick={() => navigate('/settings')}
          style={{ fontSize: 12, color: 'var(--color-text-secondary)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, padding: 0 }}
        >
          <i className="ti ti-arrow-left" style={{ fontSize: 12 }} />
          Settings
        </button>
      </div>

      <h1 style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 4, marginTop: 8 }}>
        Vendor Default GL Accounts
      </h1>
      <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 20, lineHeight: 1.5 }}>
        Set a default GL account for each vendor. <strong>QB Default</strong> is what QuickBooks has on file — set a <strong>Purchasomatic Override</strong> to use a different account without changing QB.
      </p>

      <div style={{ marginBottom: 12 }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search vendors…"
          style={{
            height: 34, width: 280,
            border: '0.5px solid var(--color-border-secondary)',
            borderRadius: 6, padding: '0 10px',
            fontSize: 13, color: 'var(--color-text-primary)',
            background: 'white', outline: 'none',
          }}
        />
      </div>

      <div style={{ background: 'white', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 8, overflow: 'hidden', marginBottom: 20 }}>
        {/* Header */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1fr 1.2fr', background: 'var(--color-background-secondary)', borderBottom: '0.5px solid var(--color-border-tertiary)', padding: '8px 14px' }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Vendor</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>QB Default</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Purchasomatic Override</span>
        </div>

        {filtered.length === 0 && (
          <p style={{ padding: '20px 14px', fontSize: 13, color: 'var(--color-text-tertiary)' }}>
            {search ? 'No vendors match your search.' : 'No vendors yet.'}
          </p>
        )}

        {filtered.map((vendor, i) => {
          const qbName = vendor.qb_default_gl_account_id
            ? (accountById.get(vendor.qb_default_gl_account_id) ?? vendor.qb_default_gl_account_id)
            : null
          const override = overrides[vendor.vendor_id] ?? ''

          return (
            <div
              key={vendor.vendor_id}
              style={{
                display: 'grid',
                gridTemplateColumns: '1.8fr 1fr 1.2fr',
                borderBottom: i < filtered.length - 1 ? '0.5px solid var(--color-border-tertiary)' : 'none',
              }}
            >
              <div style={cellStyle}>
                <span style={{ fontWeight: 500 }}>{vendor.vendor_name_display ?? '—'}</span>
              </div>
              <div style={cellStyle}>
                {qbName
                  ? <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{qbName}</span>
                  : <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>—</span>
                }
              </div>
              <div style={{ ...cellStyle, paddingRight: 14 }}>
                <select
                  value={override}
                  onChange={e => setOverrides(prev => ({ ...prev, [vendor.vendor_id]: e.target.value || null }))}
                  style={selectStyle}
                >
                  <option value="">— Use QB default —</option>
                  {accounts.map(a => (
                    <option key={a.qb_account_id} value={a.qb_account_id}>{a.name}</option>
                  ))}
                </select>
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={isPending || !isDirty}
          style={{
            background: '#2DB87A', color: 'white',
            border: 'none', borderRadius: 6,
            padding: '8px 20px', fontSize: 13, fontWeight: 500,
            cursor: isPending || !isDirty ? 'default' : 'pointer',
            opacity: isPending || !isDirty ? 0.5 : 1,
          }}
        >
          {isPending ? 'Saving…' : 'Save & Close'}
        </button>
        <button
          onClick={() => navigate('/settings')}
          style={{
            background: 'white', color: 'var(--color-text-primary)',
            border: '0.5px solid var(--color-border-secondary)',
            borderRadius: 6, padding: '8px 20px', fontSize: 13, cursor: 'pointer',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
