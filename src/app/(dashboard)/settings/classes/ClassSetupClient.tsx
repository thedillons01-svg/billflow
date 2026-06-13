'use client'

import { useTransition, useState } from 'react'
import Link from 'next/link'
import {
  setClassAssignmentMode,
  assignVendorToClass,
  assignCustomerToClass,
  createQBClass,
} from './actions'

type QBClass = { qb_class_id: string; name: string }
type Vendor = { vendor_id: string; vendor_name_display: string | null; billflow_class_id: string | null }
type Customer = { qb_job_id: string; job_name: string | null; customer_name: string | null; assigned_class_id: string | null }

type Props = {
  companyId: string
  mode: 'vendor' | 'customer'
  classes: QBClass[]
  vendors: Vendor[]
  customers: Customer[]
}

export function ClassSetupClient({ companyId, mode: initialMode, classes, vendors, customers }: Props) {
  const [isPending, startTransition] = useTransition()
  const [mode, setMode] = useState(initialMode)
  const [selectedClassId, setSelectedClassId] = useState<string | null>(classes[0]?.qb_class_id ?? null)
  const [search, setSearch] = useState('')

  // entityId → classId | null
  const [vendorClasses, setVendorClasses] = useState<Record<string, string | null>>(() => {
    const m: Record<string, string | null> = {}
    for (const v of vendors) m[v.vendor_id] = v.billflow_class_id ?? null
    return m
  })
  const [customerClasses, setCustomerClasses] = useState<Record<string, string | null>>(() => {
    const m: Record<string, string | null> = {}
    for (const c of customers) m[c.qb_job_id] = c.assigned_class_id ?? null
    return m
  })

  // Add class form
  const [newClassName, setNewClassName] = useState('')
  const [newClassError, setNewClassError] = useState<string | null>(null)
  const [newClassPending, setNewClassPending] = useState(false)
  const [localClasses, setLocalClasses] = useState<QBClass[]>(classes)

  function handleModeChange(next: 'vendor' | 'customer') {
    setMode(next)
    setSearch('')
    startTransition(() => setClassAssignmentMode(companyId, next))
  }

  function handleAdd(entityId: string) {
    if (!selectedClassId) return
    if (mode === 'vendor') {
      setVendorClasses(prev => ({ ...prev, [entityId]: selectedClassId }))
      startTransition(() => assignVendorToClass(entityId, selectedClassId))
    } else {
      setCustomerClasses(prev => ({ ...prev, [entityId]: selectedClassId }))
      startTransition(() => assignCustomerToClass(companyId, entityId, selectedClassId))
    }
  }

  function handleRemove(entityId: string) {
    if (mode === 'vendor') {
      setVendorClasses(prev => ({ ...prev, [entityId]: null }))
      startTransition(() => assignVendorToClass(entityId, null))
    } else {
      setCustomerClasses(prev => ({ ...prev, [entityId]: null }))
      startTransition(() => assignCustomerToClass(companyId, entityId, null))
    }
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

  const inClass = allEntities.filter(e => entityClasses[e.id] === selectedClassId)
  const available = allEntities
    .filter(e => entityClasses[e.id] == null)
    .filter(e => !search || e.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name))

  const selectedClass = localClasses.find(c => c.qb_class_id === selectedClassId)

  const inputStyle: React.CSSProperties = {
    height: 34,
    border: '0.5px solid var(--color-border-secondary)',
    borderRadius: 6,
    padding: '0 10px',
    fontSize: 13,
    color: 'var(--color-text-primary)',
    background: 'white',
    outline: 'none',
    width: '100%',
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
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F7F9F8' }}>
      {/* Page header */}
      <div style={{ background: 'white', borderBottom: '0.5px solid var(--color-border-tertiary)', padding: '14px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ marginBottom: 4 }}>
              <Link href="/settings" style={{ fontSize: 12, color: 'var(--color-text-secondary)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <i className="ti ti-arrow-left" style={{ fontSize: 12 }} />
                Settings
              </Link>
            </div>
            <h1 style={{ fontSize: 16, fontWeight: 500, color: 'var(--color-text-primary)', margin: 0 }}>Class Assignments</h1>
            <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>
              Assign QuickBooks classes to {entityType}s so bills are coded automatically.
            </p>
          </div>
          {isPending && (
            <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <i className="ti ti-loader-2" style={{ fontSize: 12, animation: 'spin 1s linear infinite' }} />
              Saving…
            </span>
          )}
        </div>
      </div>

      <div style={{ padding: 20, maxWidth: 860, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>

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
                  onChange={() => handleModeChange(opt.value)}
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
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: localClasses.length > 0 ? 14 : 0 }}>
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

          {/* Add class inline */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <input
              type="text"
              value={newClassName}
              onChange={e => setNewClassName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAddClass() }}
              placeholder="New class name…"
              style={{ ...inputStyle, width: 220 }}
            />
            <button
              onClick={handleAddClass}
              disabled={newClassPending || !newClassName.trim()}
              style={{
                height: 34,
                background: '#2DB87A',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                padding: '0 14px',
                fontSize: 13,
                fontWeight: 500,
                cursor: newClassPending || !newClassName.trim() ? 'not-allowed' : 'pointer',
                opacity: newClassPending || !newClassName.trim() ? 0.6 : 1,
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
            Creates the class in QuickBooks and adds it here immediately.
          </p>
        </div>

        {/* Available / Selected */}
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
                  placeholder={`Search ${entityType}s…`}
                  style={{ ...inputStyle, height: 30, fontSize: 12 }}
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
                  In {selectedClass?.name ?? ''}
                </p>
              </div>
              <div style={{ maxHeight: 340, overflowY: 'auto' }}>
                {inClass.length === 0 ? (
                  <p style={{ padding: '20px 12px', fontSize: 12, color: 'var(--color-text-tertiary)', textAlign: 'center' }}>
                    Click a {entityType} on the left to add it
                  </p>
                ) : (
                  inClass
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map(e => (
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
              Sync QuickBooks from Settings to import existing classes, or add one above.
            </p>
          </div>
        )}

      </div>
    </div>
  )
}
