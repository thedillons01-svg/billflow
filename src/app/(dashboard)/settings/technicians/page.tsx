import { createClient } from '@/lib/supabase/server'
import { TechniciansClient } from './TechniciansClient'

export default async function TechniciansPage() {
  const supabase = await createClient()
  const { data: technicians } = await supabase
    .from('technicians')
    .select('technician_id, name, phone, is_active')
    .order('is_active', { ascending: false })
    .order('name')

  return (
    <div className="flex flex-col h-full">
      <div
        className="flex-none flex items-center gap-3 px-5 py-[14px]"
        style={{ background: 'white', borderBottom: '0.5px solid var(--color-border-tertiary)' }}
      >
        <a href="/settings" style={{ fontSize: 13, color: 'var(--color-text-secondary)', textDecoration: 'none' }}>
          Settings
        </a>
        <i className="ti ti-chevron-right" style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }} />
        <span style={{ fontSize: 13, color: 'var(--color-text-primary)', fontWeight: 500 }}>Technicians</span>
      </div>

      <div className="flex-1 overflow-auto px-5 py-5">
        <div style={{ maxWidth: 560 }}>
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 4 }}>
              Technicians
            </h2>
            <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.55 }}>
              Add your technicians here so you can assign them to purchase orders and notify them when their parts arrive at the office.
            </p>
          </div>

          <TechniciansClient technicians={technicians ?? []} />
        </div>
      </div>
    </div>
  )
}
