'use client'

import { useState, useRef } from 'react'
import { addTechnician, updateTechnician, deactivateTechnician, reactivateTechnician } from './actions'

type Tech = { technician_id: string; name: string; phone: string | null; is_active: boolean }

export function TechniciansClient({ technicians }: { technicians: Tech[] }) {
  const [editing, setEditing] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const addRef = useRef<HTMLFormElement>(null)

  const active   = technicians.filter(t => t.is_active)
  const inactive = technicians.filter(t => !t.is_active)

  async function handleAdd(formData: FormData) {
    setPending(true)
    await addTechnician(formData)
    addRef.current?.reset()
    setPending(false)
  }

  async function handleUpdate(id: string, formData: FormData) {
    setPending(true)
    await updateTechnician(id, formData)
    setEditing(null)
    setPending(false)
  }

  return (
    <div>
      {/* Active techs */}
      <div
        style={{
          background: 'white',
          border: '0.5px solid var(--color-border-tertiary)',
          borderRadius: 8,
          overflow: 'hidden',
          marginBottom: 12,
        }}
      >
        {active.length === 0 && (
          <p style={{ padding: '16px 20px', fontSize: 13, color: 'var(--color-text-tertiary)' }}>
            No technicians yet. Add one below.
          </p>
        )}

        {active.map((tech, i) => (
          <div
            key={tech.technician_id}
            style={{
              borderBottom: i < active.length - 1 ? '0.5px solid var(--color-border-tertiary)' : 'none',
            }}
          >
            {editing === tech.technician_id ? (
              <form
                action={fd => handleUpdate(tech.technician_id, fd)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px' }}
              >
                <input
                  name="name"
                  defaultValue={tech.name}
                  required
                  placeholder="Name"
                  style={inputStyle}
                />
                <input
                  name="phone"
                  defaultValue={tech.phone ?? ''}
                  placeholder="Phone (optional)"
                  type="tel"
                  style={{ ...inputStyle, width: 160 }}
                />
                <button type="submit" disabled={pending} style={btnPrimary}>Save</button>
                <button type="button" onClick={() => setEditing(null)} style={btnGhost}>Cancel</button>
              </form>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 16 }}>
                  <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)', margin: 0 }}>
                    {tech.name}
                  </p>
                  {tech.phone && (
                    <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: 0 }}>
                      {tech.phone}
                    </p>
                  )}
                </div>
                <button onClick={() => setEditing(tech.technician_id)} style={btnGhost}>
                  Edit
                </button>
                <form action={() => deactivateTechnician(tech.technician_id)}>
                  <button type="submit" style={{ ...btnGhost, color: '#9CA3AF' }}>
                    Remove
                  </button>
                </form>
              </div>
            )}
          </div>
        ))}

        {/* Add row */}
        <form
          ref={addRef}
          action={handleAdd}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 16px',
            borderTop: active.length > 0 ? '0.5px solid var(--color-border-tertiary)' : 'none',
            background: '#FAFAFA',
          }}
        >
          <input
            name="name"
            required
            placeholder="Technician name"
            style={inputStyle}
          />
          <input
            name="phone"
            placeholder="Phone (optional)"
            type="tel"
            style={{ ...inputStyle, width: 160 }}
          />
          <button type="submit" disabled={pending} style={btnPrimary}>
            Add
          </button>
        </form>
      </div>

      {/* Inactive / removed techs */}
      {inactive.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
            Removed
          </p>
          <div
            style={{
              background: 'white',
              border: '0.5px solid var(--color-border-tertiary)',
              borderRadius: 8,
              overflow: 'hidden',
            }}
          >
            {inactive.map((tech, i) => (
              <div
                key={tech.technician_id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px',
                  borderBottom: i < inactive.length - 1 ? '0.5px solid var(--color-border-tertiary)' : 'none',
                }}
              >
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 16 }}>
                  <p style={{ fontSize: 13, color: 'var(--color-text-tertiary)', margin: 0 }}>{tech.name}</p>
                  {tech.phone && (
                    <p style={{ fontSize: 13, color: 'var(--color-text-tertiary)', margin: 0 }}>{tech.phone}</p>
                  )}
                </div>
                <form action={() => reactivateTechnician(tech.technician_id)}>
                  <button type="submit" style={btnGhost}>Restore</button>
                </form>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  flex: 1,
  fontSize: 13,
  padding: '7px 10px',
  border: '0.5px solid var(--color-border-tertiary)',
  borderRadius: 6,
  outline: 'none',
  color: 'var(--color-text-primary)',
  background: 'white',
}

const btnPrimary: React.CSSProperties = {
  fontSize: 13, fontWeight: 500,
  background: '#2DB87A', color: 'white',
  border: 'none', borderRadius: 6,
  padding: '7px 16px', cursor: 'pointer',
  whiteSpace: 'nowrap',
}

const btnGhost: React.CSSProperties = {
  fontSize: 13, fontWeight: 400,
  background: 'transparent', color: 'var(--color-text-secondary)',
  border: '0.5px solid var(--color-border-tertiary)', borderRadius: 6,
  padding: '6px 12px', cursor: 'pointer',
  whiteSpace: 'nowrap',
}
