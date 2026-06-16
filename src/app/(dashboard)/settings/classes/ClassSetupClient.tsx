'use client'

import { useTransition, useState, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { saveClassSetup, createQBClass } from './actions'
import { applyCustomerClassToBills } from '../../vendors/[id]/actions'
import { useDirty, useGuardedNavigate } from '@/components/unsaved-guard'

type QBClass = { qb_class_id: string; name: string }
type Vendor = { vendor_id: string; vendor_name_display: string | null; billflow_class_id: string | null }
type Customer = { qb_job_id: string; job_name: string | null; customer_name: string | null; assigned_class_id: string | null }

type Props = {
  companyId: string
  mode: 'vendor' | 'customer'
  classes: QBClass[]
  vendors: Vendor[]
  customers: Customer[]
  isQBConnected: boolean
}

export function ClassSetupClient({ companyId, mode: initialMode, classes, vendors, customers, isQBConnected }: Props) {
  const router = useRouter()
  const navigate = useGuardedNavigate()
  const { setDirty, registerSaveFn } = useDirty()
  const [isSaving, startSave] = useTransition()
  const [applyPrompt, setApplyPrompt] = useState<{ customerIds: string[] } | null>(null)
  const [isApplying, setIsApplying] = useState(false)
  const [applyResult, setApplyResult] = useState<string | null>(null)

  const [mode, setMode] = useState(initialMode)
  const [selectedClassId, setSelectedClassId] = useState<string | null>(classes[0]?.qb_class_id ?? null)
  const [search, setSearch] = useState('')

  // Working state — local only until Save & Close
  const initVendorClasses = useCallback(() => {
    const m: Record<string, string | null> = {}
    for (const v of vendors) m[v.vendor_id] = v.billflow_class_id ?? null
    return m
  }, [vendors])

  const initCustomerClasses = useCallback(() => {
    const m: Record<string, string | null> = {}
    for (const c of customers) m[c.qb_job_id] = c.assigned_class_id ?? null
    return m
  }, [customers])

  const [vendorClasses, setVendorClasses] = useState<Record<string, string | null>>(initVendorClasses)
  const [customerClasses, setCustomerClasses] = useState<Record<string, string | null>>(initCustomerClasses)

  // Saved baseline — what's actually persisted. Compared against (not the original props)
  // so that dirtiness clears correctly after a save that doesn't navigate away (e.g. the
  // apply-to-existing-bills interstitial keeps this component mounted post-save).
  const [savedMode, setSavedMode] = useState(initialMode)
  const [savedVendorClasses, setSavedVendorClasses] = useState<Record<string, string | null>>(initVendorClasses)
  const [savedCustomerClasses, setSavedCustomerClasses] = useState<Record<string, string | null>>(initCustomerClasses)

  const isDirty = useCallback(() => {
    if (mode !== savedMode) return true
    return vendors.some(v => savedVendorClasses[v.vendor_id] !== vendorClasses[v.vendor_id])
      || customers.some(c => savedCustomerClasses[c.qb_job_id] !== customerClasses[c.qb_job_id])
  }, [mode, savedMode, vendors, customers, savedVendorClasses, savedCustomerClasses, vendorClasses, customerClasses])

  // Feed local dirtiness into the global nav guard so leaving this page (sidebar, breadcrumb,
  // browser back/refresh) gets the same branded unsaved-changes prompt as the rest of the app.
  useEffect(() => {
    setDirty(isDirty())
  }, [isDirty, setDirty])

  const performSaveRef = useRef<() => Promise<void>>(async () => {})
  useEffect(() => {
    registerSaveFn(() => performSaveRef.current())
    return () => registerSaveFn(null)
  }, [registerSaveFn])

  // Add class form — this still saves immediately (QB API call, can't undo)
  const [newClassName, setNewClassName] = useState('')
  const [newClassError, setNewClassError] = useState<string | null>(null)
  const [newClassPending, setNewClassPending] = useState(false)
  const [localClasses, setLocalClasses] = useState<QBClass[]>(classes)

  function handleAdd(entityId: string) {
    if (!selectedClassId) return
    if (mode === 'vendor') setVendorClasses(prev => ({ ...prev, [entityId]: selectedClassId }))
    else setCustomerClasses(prev => ({ ...prev, [entityId]: selectedClassId }))
  }

  function handleRemove(entityId: string) {
    if (mode === 'vendor') setVendorClasses(prev => ({ ...prev, [entityId]: null }))
    else setCustomerClasses(prev => ({ ...prev, [entityId]: null }))
  }

  function handleCancel() {
    navigate('/settings')
  }

  performSaveRef.current = async () => {
    // Compute only changed entries (vs. the saved baseline) to minimise DB writes
    const vendorChanges = vendors
      .filter(v => savedVendorClasses[v.vendor_id] !== vendorClasses[v.vendor_id])
      .map(v => ({ vendorId: v.vendor_id, classId: vendorClasses[v.vendor_id] }))

    const customerChanges = customers
      .filter(c => savedCustomerClasses[c.qb_job_id] !== customerClasses[c.qb_job_id])
      .map(c => ({ qbJobId: c.qb_job_id, classId: customerClasses[c.qb_job_id] }))

    await saveClassSetup(companyId, mode, vendorChanges, customerChanges)

    setSavedMode(mode)
    setSavedVendorClasses(vendorClasses)
    setSavedCustomerClasses(customerClasses)
    setDirty(false)

    // After saving in customer mode, offer to apply updated class assignments to existing bills
    const changedCustomerIds = customerChanges
      .filter(c => c.classId !== null)
      .map(c => c.qbJobId)

    if (mode === 'customer' && changedCustomerIds.length > 0) {
      setApplyPrompt({ customerIds: changedCustomerIds })
      setApplyResult(null)
    } else {
      router.push('/settings')
    }
  }

  function handleSave() {
    startSave(() => performSaveRef.current())
  }

  async function handleAddClass() {
    if (!newClassName.trim()) return
    setNewClassError(null)
    setNewClassPending(true)
    const result = await createQBClass(companyId, newClassName)
    setNewClassPending(false)
    if ('error' in result) {
      setNewClassError(result.error)
    } else {
      const updated = [...localClasses, result].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
      setLocalClasses(updated)
      setSelectedClassId(result.qb_class_id)
      setNewClassName('')
    }
  }

  const entityClasses = mode === 'vendor' ? vendorClasses : customerClasses
  const allEntities = mode === 'vendor'
    ? vendors.map(v => ({ id: v.vendor_id, name: v.vendor_name_display ?? v.vendor_id }))
    : customers.map(c => ({ id: c.qb_job_id, name: c.job_name ?? c.customer_name ?? c.qb_job_id }))

  const entityType = mode === 'vendor' ? 'vendor' : 'customer'
  const selectedClass = localClasses.find(c => c.qb_class_id === selectedClassId)

  const inClass = allEntities
    .filter(e => entityClasses[e.id] === selectedClassId)
    .sort((a, b) => a.name.localeCompare(b.name))

  const available = allEntities
    .filter(e => entityClasses[e.id] == null)
    .filter(e => !search || e.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name))

  const inputStyle: React.CSSProperties = {
    height: 34,
    border: '0.5px solid var(--color-border-secondary)',
    borderRadius: 6,
    padding: '0 10px',
    fontSize: 13,
    color: 'var(--color-text-primary)',
    background: 'white',
    outline: 'none',
  }

  const listItemStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '7px 10px',
    fontSize: 13,
    color: 'var(--color-text-primary)',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
    cursor: 'pointer',
    background: 'white',
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F7F9F8', display: 'flex', flexDirection: 'column' }}>

      {/* Page header */}
      <div style={{ background: 'white', borderBottom: '0.5px solid var(--color-border-tertiary)', padding: '14px 20px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ marginBottom: 4 }}>
              <button
                onClick={handleCancel}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 12, color: 'var(--color-text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 4 }}
              >
                <i className="ti ti-arrow-left" style={{ fontSize: 12 }} />
                Settings
              </button>
            </div>
            <h1 style={{ fontSize: 16, fontWeight: 500, color: 'var(--color-text-primary)', margin: 0 }}>Class Assignments</h1>
            <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>
              Assign QuickBooks classes to {entityType}s so bills are coded automatically.
            </p>
          </div>
          <div />
        </div>
      </div>

      <div style={{ padding: 20, maxWidth: 860, margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {!isQBConnected && (
          <div
            style={{
              background: '#EBF5EF',
              border: '0.5px solid #C3DEC9',
              borderRadius: 8,
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <i className="ti ti-plug" style={{ fontSize: 15, color: '#1A3D2B', flexShrink: 0 }} />
              <p style={{ fontSize: 12, color: '#1A3D2B' }}>
                <span style={{ fontWeight: 600 }}>QuickBooks isn&apos;t connected yet.</span>
                {' '}Classes live in QuickBooks, so you&apos;ll need to connect it before you can import or create any here.
              </p>
            </div>
            <a
              href="/settings"
              style={{
                flexShrink: 0,
                background: '#1A3D2B', color: 'white',
                fontSize: 12, fontWeight: 600,
                padding: '6px 14px', borderRadius: 6,
                textDecoration: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              Connect QuickBooks
            </a>
          </div>
        )}

        {/* Mode selector */}
        <div style={{ background: 'white', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 8, padding: '14px 16px' }}>
          <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 10 }}>Assign class by</p>
          <div style={{ display: 'flex', gap: 10 }}>
            {([
              { value: 'vendor', label: 'Vendor', desc: 'Every invoice from a vendor gets the same class.' },
              { value: 'customer', label: 'Customer', desc: 'Class follows the customer — e.g., Commercial vs. Residential.' },
            ] as const).map(opt => (
              <label
                key={opt.value}
                style={{
                  flex: 1,
                  display: 'flex',
                  gap: 10,
                  padding: '10px 12px',
                  border: `1.5px solid ${mode === opt.value ? '#2DB87A' : 'var(--color-border-tertiary)'}`,
                  borderRadius: 6,
                  cursor: 'pointer',
                  background: mode === opt.value ? '#EBF5EF' : 'white',
                }}
              >
                <input
                  type="radio"
                  name="mode"
                  value={opt.value}
                  checked={mode === opt.value}
                  onChange={() => { setMode(opt.value); setSearch('') }}
                  style={{ marginTop: 2, accentColor: '#2DB87A' }}
                />
                <div>
                  <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: 1 }}>{opt.label}</p>
                  <p style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{opt.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Class picker + add */}
        <div style={{ background: 'white', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 8, padding: '14px 16px' }}>
          <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 10 }}>Select a class to configure</p>
          {localClasses.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
              {localClasses.map(cls => (
                <button
                  key={cls.qb_class_id}
                  onClick={() => { setSelectedClassId(cls.qb_class_id); setSearch('') }}
                  style={{
                    padding: '5px 14px',
                    borderRadius: 6,
                    fontSize: 13,
                    fontWeight: selectedClassId === cls.qb_class_id ? 500 : 400,
                    border: `1.5px solid ${selectedClassId === cls.qb_class_id ? '#2DB87A' : 'var(--color-border-secondary)'}`,
                    background: selectedClassId === cls.qb_class_id ? '#EBF5EF' : 'white',
                    color: selectedClassId === cls.qb_class_id ? '#1A3D2B' : 'var(--color-text-primary)',
                    cursor: 'pointer',
                  }}
                >
                  {cls.name}
                </button>
              ))}
            </div>
          )}

          {/* Add class */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <input
              type="text"
              value={newClassName}
              onChange={e => setNewClassName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAddClass() }}
              placeholder="New class name…"
              disabled={!isQBConnected}
              style={{ ...inputStyle, width: 220, opacity: isQBConnected ? 1 : 0.6, cursor: isQBConnected ? 'text' : 'not-allowed' }}
            />
            <button
              onClick={handleAddClass}
              disabled={!isQBConnected || newClassPending || !newClassName.trim()}
              style={{
                height: 34,
                background: '#2DB87A',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                padding: '0 14px',
                fontSize: 13,
                fontWeight: 500,
                cursor: !isQBConnected || newClassPending || !newClassName.trim() ? 'not-allowed' : 'pointer',
                opacity: !isQBConnected || newClassPending || !newClassName.trim() ? 0.6 : 1,
                whiteSpace: 'nowrap',
              }}
            >
              {newClassPending ? 'Adding…' : 'Add to QuickBooks'}
            </button>
          </div>
          {newClassError && (
            <p style={{ fontSize: 11, color: '#991B1B', marginTop: 5, display: 'flex', alignItems: 'center', gap: 4 }}>
              <i className="ti ti-alert-triangle" style={{ fontSize: 11 }} />
              {newClassError}
            </p>
          )}
          <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 5 }}>
            {isQBConnected
              ? `Creates the class in QuickBooks immediately. You can then assign ${entityType}s to it.`
              : 'Connect QuickBooks above before adding classes.'}
          </p>
        </div>

        {/* Available / In class */}
        {selectedClassId && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

            {/* Available */}
            <div style={{ background: 'white', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ padding: '10px 12px', borderBottom: '0.5px solid var(--color-border-tertiary)', background: 'var(--color-background-secondary)' }}>
                <p style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-secondary)', marginBottom: 6 }}>
                  Available {entityType}s
                </p>
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder={`Search…`}
                  style={{ ...inputStyle, height: 30, fontSize: 12, width: '100%' }}
                />
              </div>
              <div style={{ maxHeight: 340, overflowY: 'auto' }}>
                {available.length === 0 ? (
                  <p style={{ padding: '20px 12px', fontSize: 12, color: 'var(--color-text-tertiary)', textAlign: 'center' }}>
                    {search ? 'No matches' : `All ${entityType}s are assigned`}
                  </p>
                ) : (
                  available.map(e => (
                    <div
                      key={e.id}
                      onClick={() => handleAdd(e.id)}
                      style={listItemStyle}
                      onMouseEnter={ev => (ev.currentTarget.style.background = '#F0FAF4')}
                      onMouseLeave={ev => (ev.currentTarget.style.background = 'white')}
                    >
                      <span>{e.name}</span>
                      <i className="ti ti-arrow-right" style={{ fontSize: 12, color: '#2DB87A' }} />
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* In class */}
            <div style={{ background: 'white', border: '1.5px solid #2DB87A', borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ padding: '10px 12px', borderBottom: '0.5px solid var(--color-border-tertiary)', background: '#EBF5EF' }}>
                <p style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#1A3D2B' }}>
                  In {selectedClass?.name ?? ''} ({inClass.length})
                </p>
              </div>
              <div style={{ maxHeight: 340, overflowY: 'auto' }}>
                {inClass.length === 0 ? (
                  <p style={{ padding: '20px 12px', fontSize: 12, color: 'var(--color-text-tertiary)', textAlign: 'center' }}>
                    Click a {entityType} on the left to add it
                  </p>
                ) : (
                  inClass.map(e => (
                    <div
                      key={e.id}
                      style={listItemStyle}
                      onMouseEnter={ev => (ev.currentTarget.style.background = '#FEF2F2')}
                      onMouseLeave={ev => (ev.currentTarget.style.background = 'white')}
                    >
                      <span>{e.name}</span>
                      <button
                        onClick={() => handleRemove(e.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)', padding: 0, display: 'flex', alignItems: 'center' }}
                        title={`Remove from ${selectedClass?.name}`}
                      >
                        <i className="ti ti-x" style={{ fontSize: 13 }} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        )}

        {localClasses.length === 0 && (
          <div style={{ background: 'white', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 8, padding: '32px 20px', textAlign: 'center' }}>
            <i className="ti ti-tag" style={{ fontSize: 32, color: 'var(--color-text-tertiary)', display: 'block', marginBottom: 10 }} />
            <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: 4 }}>No classes yet</p>
            <p style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
              {isQBConnected
                ? 'Sync QuickBooks from Settings to import existing classes, or add one above.'
                : 'Connect QuickBooks to import existing classes, or create new ones here.'}
            </p>
          </div>
        )}

      </div>

      {/* Apply-to-existing prompt — shown after saving customer class assignments */}
      {applyPrompt && (
        <div style={{ background: '#FFFBEB', border: '0.5px solid #FDE68A', borderRadius: 6, padding: '12px 16px', margin: '0 20px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <p style={{ fontSize: 13, fontWeight: 500, color: '#92400E', margin: 0 }}>
            Apply updated class assignments to existing unpublished bills?
          </p>
          <p style={{ fontSize: 12, color: '#B45309', margin: 0 }}>
            Bills matched to the {applyPrompt.customerIds.length} updated customer{applyPrompt.customerIds.length !== 1 ? 's' : ''} will have their class updated.
          </p>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button
              type="button"
              disabled={isApplying}
              onClick={async () => {
                setIsApplying(true)
                const r = await applyCustomerClassToBills(companyId, applyPrompt.customerIds)
                setIsApplying(false)
                setApplyPrompt(null)
                setApplyResult(r.count === 0 ? 'No unpublished bills to update.' : `Updated ${r.count} unpublished bill${r.count !== 1 ? 's' : ''}.`)
              }}
              style={{ fontSize: 12, fontWeight: 600, color: 'white', background: '#D97706', border: 'none', borderRadius: 5, padding: '5px 12px', cursor: 'pointer', opacity: isApplying ? 0.6 : 1 }}
            >
              {isApplying ? 'Applying…' : 'Yes, apply'}
            </button>
            <button
              type="button"
              onClick={() => { setApplyPrompt(null); router.push('/settings') }}
              style={{ fontSize: 12, color: '#B45309', background: 'none', border: 'none', cursor: 'pointer', padding: '5px 0' }}
            >
              Skip
            </button>
          </div>
          {applyResult && <p style={{ fontSize: 12, color: '#065F46', margin: 0 }}>{applyResult}</p>}
          {applyResult && (
            <button type="button" onClick={() => router.push('/settings')} style={{ alignSelf: 'flex-start', fontSize: 12, color: '#1A3D2B', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              Close →
            </button>
          )}
        </div>
      )}

      {/* Sticky bottom bar */}
      <div style={{
        position: 'sticky',
        bottom: 0,
        background: 'white',
        borderTop: '0.5px solid var(--color-border-tertiary)',
        padding: '12px 20px',
        display: 'flex',
        justifyContent: 'flex-end',
        gap: 8,
      }}>
        <button
          onClick={handleCancel}
          disabled={isSaving}
          style={{
            height: 34,
            padding: '0 16px',
            fontSize: 13,
            fontWeight: 500,
            background: 'white',
            color: 'var(--color-text-primary)',
            border: '0.5px solid var(--color-border-secondary)',
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={isSaving}
          style={{
            height: 34,
            padding: '0 16px',
            fontSize: 13,
            fontWeight: 500,
            background: '#2DB87A',
            color: 'white',
            border: 'none',
            borderRadius: 6,
            cursor: isSaving ? 'not-allowed' : 'pointer',
            opacity: isSaving ? 0.7 : 1,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          {isSaving && <i className="ti ti-loader-2" style={{ fontSize: 13, animation: 'spin 1s linear infinite' }} />}
          {isSaving ? 'Saving…' : 'Save & Close'}
        </button>
      </div>

    </div>
  )
}
