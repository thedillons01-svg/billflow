'use client'

// Product + job filters shared by the Purchase Orders list and Receiving.
// Product searches line-item descriptions; job matches the PO's header job
// or any line's job (jobs are assigned per line, so a PO can span several).

export type FilterableLine = { line_id: string; description: string | null; job_id: string | null }

export type PoFilterValues = { product: string; job: string }

export function matchPoFilters(
  po: { job_id: string | null; lines: FilterableLine[] },
  { product, job }: PoFilterValues,
  jobMap: Map<string, string>,
): { match: boolean; matchedLineIds: Set<string> } {
  const productQ = product.trim().toLowerCase()
  const jobQ = job.trim().toLowerCase()
  const matchedLineIds = new Set<string>()

  if (productQ) {
    for (const line of po.lines) {
      if ((line.description ?? '').toLowerCase().includes(productQ)) matchedLineIds.add(line.line_id)
    }
    if (matchedLineIds.size === 0) return { match: false, matchedLineIds }
  }

  if (jobQ) {
    const jobIds = new Set([po.job_id, ...po.lines.map(l => l.job_id)].filter(Boolean) as string[])
    const hit = [...jobIds].some(id => (jobMap.get(id) ?? id).toLowerCase().includes(jobQ))
    if (!hit) return { match: false, matchedLineIds }
  }

  return { match: true, matchedLineIds }
}

// Jobs that actually appear on these POs, most recently ordered first.
export function jobOptionsFor(
  pos: { job_id: string | null; order_date: string | null; lines: FilterableLine[] }[],
  jobMap: Map<string, string>,
): string[] {
  const latest = new Map<string, string>()
  for (const po of pos) {
    const ids = [po.job_id, ...po.lines.map(l => l.job_id)].filter(Boolean) as string[]
    for (const id of ids) {
      const date = po.order_date ?? ''
      if (!latest.has(id) || date > latest.get(id)!) latest.set(id, date)
    }
  }
  return [...latest.entries()]
    .sort((a, b) => b[1].localeCompare(a[1]))
    .map(([id]) => jobMap.get(id) ?? id)
    .filter((label, i, arr) => arr.indexOf(label) === i)
}

const inputStyle = {
  width: '100%', height: 34, boxSizing: 'border-box' as const,
  border: '0.5px solid var(--color-border-secondary)', borderRadius: 7,
  padding: '0 10px 0 30px', fontSize: 13, outline: 'none', background: 'white',
}

const iconStyle = {
  position: 'absolute' as const, left: 9, top: '50%', transform: 'translateY(-50%)',
  fontSize: 13, color: 'var(--color-text-tertiary)', pointerEvents: 'none' as const,
}

export function ProductFilterInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
      <i className="ti ti-box" style={iconStyle} />
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="Filter by product…"
        title="Matches any line item on the PO, e.g. “condenser” or “R-410A”"
        style={inputStyle}
      />
    </div>
  )
}

export function JobFilterInput({ value, onChange, options, listId }: {
  value: string
  onChange: (v: string) => void
  options: string[]
  listId: string
}) {
  return (
    <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
      <i className="ti ti-briefcase" style={iconStyle} />
      <input
        type="text"
        list={listId}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="Filter by job…"
        title="Type part of a customer, job number, or job name — or pick from the list"
        style={inputStyle}
      />
      <datalist id={listId}>
        {options.map(label => <option key={label} value={label} />)}
      </datalist>
    </div>
  )
}
