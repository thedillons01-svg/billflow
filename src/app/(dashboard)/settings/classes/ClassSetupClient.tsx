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

  // entityId → classId (null = unassigned)
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
    startTransition(() => setClassAssignmentMode(companyId, next))
  }

  function handleAssignVendor(vendorId: string, classId: string | null) {
    setVendorClasses(prev => ({ ...prev, [vendorId]: classId }))
    startTransition(() => assignVendorToClass(vendorId, classId))
  }

  function handleAssignCustomer(qbJobId: string, classId: string | null) {
    setCustomerClasses(prev => ({ ...prev, [qbJobId]: classId }))
    startTransition(() => assignCustomerToClass(companyId, qbJobId, classId))
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
      setLocalClasses(prev => [...prev, result].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '')))
      setNewClassName('')
    }
  }

  const entities = mode === 'vendor'
    ? vendors.map(v => ({ id: v.vendor_id, name: v.vendor_name_display ?? v.vendor_id }))
    : customers.map(c => ({ id: c.qb_job_id, name: c.job_name ?? c.customer_name ?? c.qb_job_id }))

  const entityClasses = mode === 'vendor' ? vendorClasses : customerClasses
  const handleAssign = mode === 'vendor'
    ? (id: string, cls: string | null) => handleAssignVendor(id, cls)
    : (id: string, cls: string | null) => handleAssignCustomer(id, cls)

  const inputStyle: React.CSSProperties = {
    height: 36,
    border: '0.5px solid var(--color-border-secondary)',
    borderRadius: 6,
    padding: '0 10px',
    fontSize: 13,
    color: 'var(--color-text-primary)',
    background: 'white',
    outline: 'none',
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F7F9F8' }}>
      {/* Page header */}
      <div style={{ background: 'white', borderBottom: '0.5px solid var(--color-border-tertiary)', padding: '14px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Link href="/settings" style={{ fontSize: 12, color: 'var(--color-text-secondary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                <i className="ti ti-arrow-left" style={{ fontSize: 12 }} />
                Settings
              </Link>
            </div>
            <h1 style={{ fontSize: 16, fontWeight: 500, color: 'var(--color-text-primary)', margin: 0 }}>Class Assignments</h1>
            <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>
              Assign QuickBooks classes to vendors or customers so bills are coded automatically.
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

      <div style={{ padding: '20px', maxWidth: 780, margin: '0 auto' }}>

        {/* Mode selector */}
        <div style={{ background: 'white', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 8, padding: '16px 20px', marginBottom: 20 }}>
          <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 10 }}>Assign class by</p>
          <div style={{ display: 'flex', gap: 12 }}>
            {([
              { value: 'vendor', label: 'Vendor', desc: 'Every invoice from a vendor gets the same class — regardless of which customer it is for.' },
              { value: 'customer', label: 'Customer', desc: 'Class is determined by the customer the invoice is matched to — e.g., Commercial vs. Residential.' },
            ] as const).map(opt => (
              <label
                key={opt.value}
                style={{
                  flex: 1,
                  display: 'flex',
                  gap: 10,
                  padding: '12px 14px',
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
                  <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: 2 }}>{opt.label}</p>
                  <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>{opt.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Classes */}
        {localClasses.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 20px', background: 'white', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 8 }}>
            <i className="ti ti-tag" style={{ fontSize: 36, color: 'var(--color-text-tertiary)', display: 'block', marginBottom: 12 }} />
            <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: 4 }}>No classes yet</p>
            <p style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
              Sync your QuickBooks data from the Settings page to import existing classes, or add a new class below.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {localClasses.map(cls => {
              const members = entities.filter(e => entityClasses[e.id] === cls.qb_class_id)
              const unassigned = entities.filter(e => entityClasses[e.id] == null)

              return (
                <div
                  key={cls.qb_class_id}
                  style={{ background: 'white', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 8, padding: '14px 16px' }}
                >
                  <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: 10 }}>
                    {cls.name}
                  </p>

                  {/* Current members */}
                  {members.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                      {members.map(m => (
                        <span
                          key={m.id}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            background: '#D1FAE5',
                            color: '#065F46',
                            fontSize: 12,
                            fontWeight: 500,
                            padding: '3px 8px 3px 10px',
                            borderRadius: 4,
                          }}
                        >
                          {m.name}
                          <button
                            onClick={() => handleAssign(m.id, null)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#065F46', padding: 0, lineHeight: 1, display: 'flex', alignItems: 'center' }}
                            title={`Remove ${m.name} from ${cls.name}`}
                          >
                            <i className="ti ti-x" style={{ fontSize: 11 }} />
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginBottom: 10 }}>
                      No {mode === 'vendor' ? 'vendors' : 'customers'} assigned to this class yet.
                    </p>
                  )}

                  {/* Add dropdown */}
                  {unassigned.length > 0 && (
                    <select
                      value=""
                      onChange={e => {
                        if (e.target.value) handleAssign(e.target.value, cls.qb_class_id)
                        e.target.value = ''
                      }}
                      style={{ ...inputStyle, width: 'auto', minWidth: 200, fontSize: 12, height: 32 }}
                    >
                      <option value="">Add {mode === 'vendor' ? 'vendor' : 'customer'}…</option>
                      {unassigned
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map(e => (
                          <option key={e.id} value={e.id}>{e.name}</option>
                        ))}
                    </select>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Add new class */}
        <div style={{ background: 'white', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 8, padding: '14px 16px', marginTop: 16 }}>
          <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 8 }}>Add a new class to QuickBooks</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              value={newClassName}
              onChange={e => setNewClassName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAddClass() }}
              placeholder="Class name (e.g., Commercial, Residential)"
              style={{ ...inputStyle, flex: 1 }}
            />
            <button
              onClick={handleAddClass}
              disabled={newClassPending || !newClassName.trim()}
              style={{
                background: '#2DB87A',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                padding: '0 14px',
                fontSize: 13,
                fontWeight: 500,
                cursor: newClassPending || !newClassName.trim() ? 'not-allowed' : 'pointer',
                opacity: newClassPending || !newClassName.trim() ? 0.6 : 1,
                height: 36,
                whiteSpace: 'nowrap',
              }}
            >
              {newClassPending ? 'Adding…' : 'Add to QuickBooks'}
            </button>
          </div>
          {newClassError && (
            <p style={{ fontSize: 11, color: '#991B1B', marginTop: 5, display: 'flex', alignItems: 'center', gap: 4 }}>
              <i className="ti ti-alert-triangle" style={{ fontSize: 12 }} />
              {newClassError}
            </p>
          )}
          <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 5 }}>
            Creates the class in QuickBooks and adds it here immediately. You can then assign vendors or customers to it.
          </p>
        </div>

        {entities.length === 0 && (
          <div style={{ marginTop: 16, padding: '10px 14px', background: '#FFFBEB', border: '0.5px solid #FDE68A', borderRadius: 6 }}>
            <p style={{ fontSize: 12, color: '#92400E', display: 'flex', alignItems: 'center', gap: 6 }}>
              <i className="ti ti-info-circle" style={{ fontSize: 13 }} />
              No {mode === 'vendor' ? 'vendors' : 'customers'} found. Sync your QuickBooks data from the Settings page to import them.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
