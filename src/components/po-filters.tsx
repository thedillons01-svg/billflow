'use client'

// Chip-style filters shared by the Purchase Orders list and Receiving.
// "+ Filter" adds a field; each field is a removable chip with an editor that
// fits it (pick-list, text, or date presets). Chips combine with AND; several
// picks inside one chip match any of them. Filters live in the URL.

import { useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { formatDateOnly } from '@/lib/utils/date'

export type FilterableLine = { line_id: string; description: string | null; job_id: string | null }

export type FilterablePo = {
  vendor: string
  po_number: string | null
  expected_delivery_date: string | null
  status: string
  job_id: string | null
  lines: FilterableLine[]
}

export type FieldKey = 'vendor' | 'product' | 'delivery' | 'status' | 'job' | 'po'

type DeliveryPreset = 'overdue' | 'today' | 'next7' | 'none' | 'range'

export type Filters = {
  vendor?: string[]
  product?: string
  delivery?: { preset: DeliveryPreset; from?: string; to?: string }
  status?: string[]
  job?: string[]
  po?: string
}

const FIELD_LABELS: Record<FieldKey, string> = {
  vendor: 'Vendor',
  product: 'Product',
  delivery: 'Expected delivery',
  status: 'Status',
  job: 'Job',
  po: 'PO #',
}

const FIELD_ICONS: Record<FieldKey, string> = {
  vendor: 'ti-building-store',
  product: 'ti-box',
  delivery: 'ti-truck-delivery',
  status: 'ti-circle-dot',
  job: 'ti-briefcase',
  po: 'ti-file-text',
}

const DELIVERY_LABELS: Record<DeliveryPreset, string> = {
  overdue: 'Overdue (not yet received)',
  today: 'Today',
  next7: 'Next 7 days',
  none: 'No date set',
  range: 'Date range',
}

// ---------- matching ----------

function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d + days)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

export function isOverdue(expected: string | null, status: string): boolean {
  return !!expected && expected < todayIso() && (status === 'open' || status === 'partially_received')
}

function matchesDelivery(expected: string | null, status: string, f: NonNullable<Filters['delivery']>): boolean {
  const today = todayIso()
  switch (f.preset) {
    case 'none':    return !expected
    case 'overdue': return isOverdue(expected, status)
    case 'today':   return expected === today
    case 'next7':   return !!expected && expected >= today && expected <= addDaysIso(today, 7)
    case 'range':
      if (!expected) return false
      if (f.from && expected < f.from) return false
      if (f.to && expected > f.to) return false
      return true
  }
}

export function matchPo(po: FilterablePo, filters: Filters): { match: boolean; matchedLineIds: Set<string> } {
  const matchedLineIds = new Set<string>()
  const no = { match: false, matchedLineIds }

  if (filters.vendor?.length && !filters.vendor.includes(po.vendor)) return no

  const productQ = filters.product?.trim().toLowerCase()
  if (productQ) {
    for (const line of po.lines) {
      if ((line.description ?? '').toLowerCase().includes(productQ)) matchedLineIds.add(line.line_id)
    }
    if (matchedLineIds.size === 0) return no
  }

  if (filters.status?.length && !filters.status.includes(po.status)) return no

  if (filters.delivery && !matchesDelivery(po.expected_delivery_date, po.status, filters.delivery)) return no

  // Jobs are assigned per line, so a PO matches if its header job or any line's job is picked.
  if (filters.job?.length) {
    const ids = [po.job_id, ...po.lines.map(l => l.job_id)]
    if (!ids.some(id => id && filters.job!.includes(id))) return no
  }

  const poQ = filters.po?.trim().toLowerCase()
  if (poQ && !(po.po_number ?? '').toLowerCase().includes(poQ)) return no

  return { match: true, matchedLineIds }
}

// ---------- URL state ----------

function readFilters(sp: URLSearchParams): Filters {
  const f: Filters = {}
  const vendor = sp.getAll('vendor').filter(Boolean)
  if (vendor.length) f.vendor = vendor
  const status = sp.getAll('status').filter(Boolean)
  if (status.length) f.status = status
  const job = sp.getAll('job').filter(Boolean)
  if (job.length) f.job = job
  if (sp.has('product')) f.product = sp.get('product') ?? ''
  if (sp.has('po')) f.po = sp.get('po') ?? ''
  const delivery = sp.get('delivery')
  if (delivery) {
    const [preset, from, to] = delivery.split(':')
    if (preset in DELIVERY_LABELS) f.delivery = { preset: preset as DeliveryPreset, from: from || undefined, to: to || undefined }
  }
  return f
}

function writeFilters(sp: URLSearchParams, f: Filters): URLSearchParams {
  const next = new URLSearchParams(sp.toString())
  for (const k of ['vendor', 'status', 'job', 'product', 'po', 'delivery']) next.delete(k)
  f.vendor?.forEach(v => next.append('vendor', v))
  f.status?.forEach(v => next.append('status', v))
  f.job?.forEach(v => next.append('job', v))
  if (f.product?.trim()) next.set('product', f.product)
  if (f.po?.trim()) next.set('po', f.po)
  if (f.delivery) {
    const { preset, from, to } = f.delivery
    next.set('delivery', preset === 'range' ? `range:${from ?? ''}:${to ?? ''}` : preset)
  }
  return next
}

function isEmpty(key: FieldKey, f: Filters): boolean {
  if (key === 'vendor' || key === 'job' || key === 'status') return !f[key]?.length
  if (key === 'product' || key === 'po') return !f[key]?.trim()
  return !f.delivery
}

// Filters mirrored into the URL (debounced) so they survive tab switches and can be bookmarked.
export function useUrlFilters(): [Filters, (f: Filters) => void] {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [filters, setFilters] = useState<Filters>(() => readFilters(new URLSearchParams(searchParams.toString())))

  useEffect(() => {
    const t = setTimeout(() => {
      const next = writeFilters(new URLSearchParams(searchParams.toString()), filters)
      if (next.toString() !== searchParams.toString()) {
        router.replace(next.toString() ? `${pathname}?${next}` : pathname, { scroll: false })
      }
    }, 400)
    return () => clearTimeout(t)
  }, [filters, pathname, router, searchParams])

  return [filters, setFilters]
}

// ---------- UI ----------

export type PickOption = { value: string; label: string }

// Vendors A–Z; jobs most recently ordered first. Only values that appear on these POs.
export function buildPickOptions(
  pos: (FilterablePo & { order_date: string | null })[],
  jobMap: Map<string, string>,
): { vendorOptions: PickOption[]; jobOptions: PickOption[] } {
  const vendors = [...new Set(pos.map(p => p.vendor))].sort((a, b) => a.localeCompare(b))
  const latest = new Map<string, string>()
  for (const po of pos) {
    for (const id of [po.job_id, ...po.lines.map(l => l.job_id)]) {
      if (!id) continue
      const date = po.order_date ?? ''
      if (!latest.has(id) || date > latest.get(id)!) latest.set(id, date)
    }
  }
  const jobs = [...latest.entries()].sort((a, b) => b[1].localeCompare(a[1]))
  return {
    vendorOptions: vendors.map(v => ({ value: v, label: v })),
    jobOptions: jobs.map(([id]) => ({ value: id, label: jobMap.get(id) ?? id })),
  }
}

export const STATUS_OPTIONS: PickOption[] = [
  { value: 'open', label: 'Open' },
  { value: 'partially_received', label: 'Partially Received' },
  { value: 'received', label: 'Received' },
  { value: 'closed', label: 'Closed' },
]

export function PoFilterBar({
  fields,
  filters,
  onChange,
  vendorOptions,
  jobOptions,
  statusOptions = STATUS_OPTIONS,
  count,
  total,
}: {
  fields: FieldKey[]
  filters: Filters
  onChange: (f: Filters) => void
  vendorOptions: PickOption[]
  jobOptions: PickOption[]
  statusOptions?: PickOption[]
  count: number
  total: number
}) {
  // Chips shown = fields with a value, plus the one being edited (a fresh chip starts empty).
  const [editing, setEditing] = useState<FieldKey | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const active = fields.filter(k => !isEmpty(k, filters) || k === editing)
  const addable = fields.filter(k => !active.includes(k))

  const remove = (k: FieldKey) => {
    const next = { ...filters }
    delete next[k]
    onChange(next)
    if (editing === k) setEditing(null)
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {active.map(k => (
        <FilterChip
          key={k}
          field={k}
          filters={filters}
          onChange={onChange}
          open={editing === k}
          setOpen={o => setEditing(o ? k : null)}
          onRemove={() => remove(k)}
          vendorOptions={vendorOptions}
          jobOptions={jobOptions}
          statusOptions={statusOptions}
        />
      ))}

      {addable.length > 0 && (
        <Popover open={menuOpen} onClose={() => setMenuOpen(false)} trigger={
          <button type="button" onClick={() => setMenuOpen(o => !o)} style={addButtonStyle}>
            <i className="ti ti-filter" style={{ fontSize: 13 }} /> Filter
          </button>
        }>
          <div style={{ padding: 4, minWidth: 190 }}>
            {addable.map(k => (
              <button
                key={k}
                type="button"
                onClick={() => { setMenuOpen(false); setEditing(k) }}
                style={menuItemStyle}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-background-secondary)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              >
                <i className={`ti ${FIELD_ICONS[k]}`} style={{ fontSize: 14, color: 'var(--color-text-tertiary)' }} />
                {FIELD_LABELS[k]}
              </button>
            ))}
          </div>
        </Popover>
      )}

      {active.some(k => !isEmpty(k, filters)) && (
        <button type="button" onClick={() => { onChange({}); setEditing(null) }} style={clearStyle}>
          Clear all
        </button>
      )}
      <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', whiteSpace: 'nowrap', marginLeft: 'auto' }}>
        {count} of {total}
      </span>
    </div>
  )
}

function chipSummary(k: FieldKey, f: Filters, vendorOptions: PickOption[], jobOptions: PickOption[], statusOptions: PickOption[]): string {
  const labelFor = (opts: PickOption[], v: string) => opts.find(o => o.value === v)?.label ?? v
  const list = (vals: string[], opts: PickOption[]) =>
    vals.length <= 2 ? vals.map(v => labelFor(opts, v)).join(', ') : `${labelFor(opts, vals[0])} +${vals.length - 1}`
  switch (k) {
    case 'vendor':  return f.vendor?.length ? list(f.vendor, vendorOptions) : 'any'
    case 'job':     return f.job?.length ? list(f.job, jobOptions) : 'any'
    case 'status':  return f.status?.length ? list(f.status, statusOptions) : 'any'
    case 'product': return f.product?.trim() ? `“${f.product.trim()}”` : 'any'
    case 'po':      return f.po?.trim() ? `“${f.po.trim()}”` : 'any'
    case 'delivery': {
      const d = f.delivery
      if (!d) return 'any'
      if (d.preset !== 'range') return DELIVERY_LABELS[d.preset]
      if (d.from && d.to) return `${formatDateOnly(d.from)} – ${formatDateOnly(d.to)}`
      if (d.from) return `after ${formatDateOnly(d.from)}`
      if (d.to) return `before ${formatDateOnly(d.to)}`
      return 'any'
    }
  }
}

function FilterChip({ field, filters, onChange, open, setOpen, onRemove, vendorOptions, jobOptions, statusOptions }: {
  field: FieldKey
  filters: Filters
  onChange: (f: Filters) => void
  open: boolean
  setOpen: (o: boolean) => void
  onRemove: () => void
  vendorOptions: PickOption[]
  jobOptions: PickOption[]
  statusOptions: PickOption[]
}) {
  const set = (patch: Filters) => onChange({ ...filters, ...patch })

  return (
    <Popover open={open} onClose={() => setOpen(false)} trigger={
      <span style={chipStyle}>
        <button type="button" onClick={() => setOpen(!open)} style={chipLabelStyle} title={`Edit ${FIELD_LABELS[field]} filter`}>
          <i className={`ti ${FIELD_ICONS[field]}`} style={{ fontSize: 13, color: '#1A3D2B' }} />
          <span style={{ color: 'var(--color-text-secondary)' }}>{FIELD_LABELS[field]}:</span>
          <span style={{ fontWeight: 500, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {chipSummary(field, filters, vendorOptions, jobOptions, statusOptions)}
          </span>
        </button>
        <button type="button" onClick={onRemove} style={chipRemoveStyle} title="Remove filter" aria-label={`Remove ${FIELD_LABELS[field]} filter`}>
          <i className="ti ti-x" style={{ fontSize: 12 }} />
        </button>
      </span>
    }>
      {(field === 'vendor' || field === 'job' || field === 'status') && (
        <PickList
          options={field === 'vendor' ? vendorOptions : field === 'job' ? jobOptions : statusOptions}
          selected={filters[field] ?? []}
          onChange={vals => set({ [field]: vals })}
          placeholder={field === 'vendor' ? 'Search vendors…' : field === 'job' ? 'Search jobs…' : 'Search statuses…'}
          emptyText={field === 'vendor' ? 'No vendors on these POs.' : 'No jobs on these POs.'}
        />
      )}
      {(field === 'product' || field === 'po') && (
        <div style={{ padding: 10, width: 280 }}>
          <input
            autoFocus
            type="text"
            value={filters[field] ?? ''}
            onChange={e => set({ [field]: e.target.value })}
            onKeyDown={e => { if (e.key === 'Enter') setOpen(false) }}
            placeholder={field === 'product' ? 'e.g. condenser, R-410A, copper' : 'Part of a PO number'}
            style={inputStyle}
          />
          <p style={helpStyle}>
            {field === 'product'
              ? 'Matches any line item on the PO. Matching lines are highlighted.'
              : 'Matches anywhere in the PO number.'}
          </p>
        </div>
      )}
      {field === 'delivery' && (
        <DeliveryEditor value={filters.delivery} onChange={d => set({ delivery: d })} />
      )}
    </Popover>
  )
}

function PickList({ options, selected, onChange, placeholder, emptyText }: {
  options: PickOption[]
  selected: string[]
  onChange: (vals: string[]) => void
  placeholder: string
  emptyText: string
}) {
  const [q, setQ] = useState('')
  const [cursor, setCursor] = useState(0)
  const shown = useMemo(
    () => options.filter(o => o.label.toLowerCase().includes(q.trim().toLowerCase())),
    [options, q],
  )
  const toggle = (v: string) => onChange(selected.includes(v) ? selected.filter(s => s !== v) : [...selected, v])

  return (
    <div style={{ width: 300 }}>
      <div style={{ padding: 8, borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
        <input
          autoFocus
          type="text"
          value={q}
          onChange={e => { setQ(e.target.value); setCursor(0) }}
          onKeyDown={e => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, shown.length - 1)) }
            if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)) }
            if (e.key === 'Enter' && shown[cursor]) { e.preventDefault(); toggle(shown[cursor].value) }
          }}
          placeholder={placeholder}
          style={inputStyle}
        />
      </div>
      <div style={{ maxHeight: 260, overflowY: 'auto', padding: 4 }}>
        {shown.length === 0 && (
          <p style={{ ...helpStyle, padding: '8px 10px', margin: 0 }}>{options.length ? 'No matches.' : emptyText}</p>
        )}
        {shown.map((o, i) => (
          <label
            key={o.value}
            style={{ ...menuItemStyle, background: i === cursor ? 'var(--color-background-secondary)' : 'none' }}
            onMouseEnter={() => setCursor(i)}
          >
            <input type="checkbox" checked={selected.includes(o.value)} onChange={() => toggle(o.value)} style={{ cursor: 'pointer' }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={o.label}>{o.label}</span>
          </label>
        ))}
      </div>
      <p style={{ ...helpStyle, padding: '6px 10px 8px', margin: 0, borderTop: '0.5px solid var(--color-border-tertiary)' }}>
        Pick one or more. ↑↓ to move, Enter to select.
      </p>
    </div>
  )
}

function DeliveryEditor({ value, onChange }: {
  value: Filters['delivery']
  onChange: (d: Filters['delivery']) => void
}) {
  const presets: DeliveryPreset[] = ['overdue', 'today', 'next7', 'none', 'range']
  return (
    <div style={{ padding: 6, width: 260 }}>
      {presets.map(p => (
        <label key={p} style={menuItemStyle}>
          <input
            type="radio"
            name="po-delivery-preset"
            checked={value?.preset === p}
            onChange={() => onChange(p === 'range' ? { preset: 'range', from: value?.from, to: value?.to } : { preset: p })}
          />
          {DELIVERY_LABELS[p]}
        </label>
      ))}
      {value?.preset === 'range' && (
        <div className="flex items-center gap-2" style={{ padding: '4px 10px 8px' }}>
          <input type="date" value={value.from ?? ''} onChange={e => onChange({ ...value, from: e.target.value || undefined })} style={dateStyle} aria-label="From" />
          <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>to</span>
          <input type="date" value={value.to ?? ''} onChange={e => onChange({ ...value, to: e.target.value || undefined })} style={dateStyle} aria-label="To" />
        </div>
      )}
      <p style={{ ...helpStyle, padding: '2px 10px 6px', margin: 0 }}>
        Uses the expected delivery date from the vendor’s PO confirmation.
      </p>
    </div>
  )
}

function Popover({ open, onClose, trigger, children }: {
  open: boolean
  onClose: () => void
  trigger: React.ReactNode
  children: React.ReactNode
}) {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) onClose() }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open, onClose])

  return (
    <span ref={ref} style={{ position: 'relative', display: 'inline-flex' }}>
      {trigger}
      {open && <div style={popoverStyle}>{children}</div>}
    </span>
  )
}

// ---------- styles ----------

const addButtonStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 5, height: 30,
  padding: '0 12px', borderRadius: 7, cursor: 'pointer',
  border: '0.5px dashed var(--color-border-secondary)', background: 'white',
  fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)',
}
const chipStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', height: 30, borderRadius: 7,
  border: '0.5px solid #C3DEC9', background: '#EBF5EF', overflow: 'hidden',
}
const chipLabelStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 5, height: '100%', padding: '0 4px 0 10px',
  background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--color-text-primary)',
}
const chipRemoveStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: '100%',
  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)',
}
const clearStyle: React.CSSProperties = {
  fontSize: 12, color: 'var(--color-text-secondary)', background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
}
const popoverStyle: React.CSSProperties = {
  position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 50,
  background: 'white', borderRadius: 8, border: '0.5px solid var(--color-border-secondary)',
  boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
}
const menuItemStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '7px 10px',
  borderRadius: 5, border: 'none', background: 'none', cursor: 'pointer',
  fontSize: 13, color: 'var(--color-text-primary)', textAlign: 'left',
}
const inputStyle: React.CSSProperties = {
  width: '100%', height: 32, boxSizing: 'border-box',
  border: '0.5px solid var(--color-border-secondary)', borderRadius: 6,
  padding: '0 10px', fontSize: 13, outline: 'none', background: 'white',
}
const dateStyle: React.CSSProperties = { ...inputStyle, padding: '0 6px', fontSize: 12 }
const helpStyle: React.CSSProperties = { fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 6, lineHeight: 1.4 }
