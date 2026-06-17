'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { saveVendorGLAccounts } from './actions'
import { applyVendorDefaultToBills } from '@/app/(dashboard)/vendors/[id]/actions'
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

type PushPrompt = {
  vendorIds: string[]
  state: 'visible' | 'applying' | 'done'
  result: string | null
}

export function VendorGLClient({
  vendors,
  accounts,
}: {
  vendors: Vendor[]
  accounts: Account[]
}) {
  const navigate = useGuardedNavigate()
  const router = useRouter()
  const { setDirty } = useDirty()
  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState('')
  const [pushPrompt, setPushPrompt] = useState<PushPrompt | null>(null)

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

    const changedVendorIds = changes.map(c => c.vendorId)

    startTransition(async () => {
      await saveVendorGLAccounts(changes)
      setSaved({ ...overrides })
      setDirty(false)
      if (changedVendorIds.length > 0) {
        setPushPrompt({ vendorIds: changedVendorIds, state: 'visible', result: null })
      } else {
        router.push('/settings')
      }
    })
  }

  async function handleApplyPush(mode: 'blank_only' | 'all_unpublished') {
    if (!pushPrompt) return
    setPushPrompt(p => p ? { ...p, state: 'applying' } : null)
    let total = 0
    for (const vendorId of pushPrompt.vendorIds) {
      const r = await applyVendorDefaultToBills(vendorId, 'gl_account', mode)
      total += r.count
    }
    const result = total === 0
      ? 'No unpublished bills to update.'
      : `Applied to ${total} bill${total !== 1 ? 's' : ''}.`
    setPushPrompt(p => p ? { ...p, state: 'done', result } : null)
    setTimeout(() => router.push('/settings'), 1500)
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

      {/* Push prompt — shown after save if GL accounts changed */}
      {pushPrompt && (
        <div style={{
          background: '#FFFBEB', border: '0.5px solid #FDE68A', borderRadius: 8,
          padding: '14px 16px', marginBottom: 16,
        }}>
          {pushPrompt.state === 'done' ? (
            <p style={{ fontSize: 13, color: '#065F46', fontWeight: 500 }}>
              <i className="ti ti-circle-check" style={{ marginRight: 6 }} />
              {pushPrompt.result} Returning to settings…
            </p>
          ) : pushPrompt.state === 'applying' ? (
            <p style={{ fontSize: 13, color: '#92400E' }}>Applying to existing bills…</p>
          ) : (
            <>
              <p style={{ fontSize: 13, fontWeight: 500, color: '#92400E', marginBottom: 8 }}>
                GL accounts saved. Apply these defaults to existing unpublished bills?
              </p>
              <p style={{ fontSize: 12, color: '#92400E', marginBottom: 12, lineHeight: 1.5 }}>
                This will update bills for {pushPrompt.vendorIds.length} vendor{pushPrompt.vendorIds.length !== 1 ? 's' : ''}. GL account rules always take priority over vendor defaults.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => handleApplyPush('blank_only')}
                  style={{ fontSize: 12, fontWeight: 500, color: '#92400E', background: 'white', border: '0.5px solid #FCD34D', borderRadius: 5, padding: '6px 14px', cursor: 'pointer' }}
                >
                  Blank fields only
                </button>
                <button
                  onClick={() => handleApplyPush('all_unpublished')}
                  style={{ fontSize: 12, fontWeight: 500, color: 'white', background: '#D97706', border: 'none', borderRadius: 5, padding: '6px 14px', cursor: 'pointer' }}
                >
                  All unpublished bills
                </button>
                <button
                  onClick={() => router.push('/settings')}
                  style={{ fontSize: 12, color: '#B45309', background: 'none', border: 'none', cursor: 'pointer', padding: '6px 4px' }}
                >
                  Skip
                </button>
              </div>
            </>
          )}
        </div>
      )}

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
