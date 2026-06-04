import { createServiceClient } from '@/lib/supabase/service'

// ── Types ──────────────────────────────────────────────────────────────

export type ExportPOLine = {
  description: string | null
  quantityOrdered: number | null
  unitCost: number | null
}

export type ExportPORecord = {
  vendorName: string
  poNumber: string | null
  orderDate: string | null
  orderedBy: string | null
  lines: ExportPOLine[]
}

export type ExportReceivingLine = {
  description: string | null
  quantityOrdered: number | null
  quantityReceived: number
  status: 'received' | 'partial' | 'not_received'
}

export type ExportReceivingRecord = {
  vendorName: string
  poNumber: string | null
  receivedAt: string | null
  receivedBy: string | null
  lines: ExportReceivingLine[]
}

export type ExportInvoicedLine = {
  description: string | null
  unitCost: number | null
  extendedCost: number | null
  quantity: number | null
}

export type ExportInvoicedRecord = {
  vendorName: string
  invoiceNumber: string | null
  invoiceDate: string | null
  lines: ExportInvoicedLine[]
  total: number
}

export type ExportJobSection = {
  jobId: string
  jobNumber: string | null
  jobName: string | null
  customerName: string | null
  poRecords: ExportPORecord[]
  receivingRecords: ExportReceivingRecord[]
  invoicedRecords: ExportInvoicedRecord[]
  totalInvoiced: number
}

export type ExportData = {
  sections: ExportJobSection[]
  include: { pos: boolean; receiving: boolean; invoiced: boolean }
  generatedAt: string
  dateRangeStart: string | null
  dateRangeEnd: string | null
}

// ── Main query ─────────────────────────────────────────────────────────

export async function getExportData(
  companyId: string,
  options: {
    dateStart?: string
    dateEnd?: string
    vendorIds?: string[]
    jobIds?: string[]
    includePOs?: boolean
    includeReceiving?: boolean
    includeInvoiced?: boolean
  }
): Promise<ExportData> {
  const supabase = createServiceClient()

  const includePOs      = options.includePOs      ?? true
  const includeReceiving = options.includeReceiving ?? true
  const includeInvoiced  = options.includeInvoiced  ?? true

  const jobSections = new Map<string, ExportJobSection>()
  const allJobIds   = new Set<string>()
  const allUserIds  = new Set<string>()

  // ── 1. Invoiced bills ────────────────────────────────────────────────
  type BillRow = {
    bill_id: string; invoice_number: string | null; invoice_date: string | null
    vendors: { vendor_name_display: string | null; vendor_name_extracted: string | null } | null
    bill_line_items: Array<{
      description: string | null; unit_cost: number | null; extended_cost: number | null
      quantity: number | null; job_id: string | null; sort_order: number; is_tax_line: boolean | null
    }>
  }
  let bills: BillRow[] = []

  if (includeInvoiced) {
    let q = supabase
      .from('bills')
      .select(`
        bill_id, invoice_number, invoice_date,
        vendors!bills_vendor_id_fkey(vendor_name_display, vendor_name_extracted),
        bill_line_items(description, unit_cost, extended_cost, quantity, job_id, sort_order, is_tax_line)
      `)
      .eq('company_id', companyId)
      .eq('status', 'published')

    if (options.dateStart) q = q.gte('invoice_date', options.dateStart)
    if (options.dateEnd)   q = q.lte('invoice_date', options.dateEnd)
    if (options.vendorIds?.length) q = q.in('vendor_id', options.vendorIds)

    const { data } = await q.order('invoice_date', { ascending: true })
    bills = (data ?? []) as unknown as BillRow[]
    for (const b of bills)
      for (const li of b.bill_line_items)
        if (li.job_id) allJobIds.add(li.job_id)
  }

  // ── 2. Purchase orders ───────────────────────────────────────────────
  type PORow = {
    po_id: string; po_number: string | null; order_date: string | null
    job_id: string | null; created_by: string | null
    vendors: { vendor_name_display: string | null; vendor_name_extracted: string | null } | null
    po_line_items: Array<{
      line_id: string; description: string | null
      quantity_ordered: number | null; unit_cost: number | null; sort_order: number
    }>
  }
  let pos: PORow[] = []

  if (includePOs) {
    let q = supabase
      .from('purchase_orders')
      .select(`
        po_id, po_number, order_date, job_id, created_by,
        vendors!purchase_orders_vendor_id_fkey(vendor_name_display, vendor_name_extracted),
        po_line_items(line_id, description, quantity_ordered, unit_cost, sort_order)
      `)
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .not('job_id', 'is', null)

    if (options.dateStart) q = q.gte('order_date', options.dateStart)
    if (options.dateEnd)   q = q.lte('order_date', options.dateEnd)
    if (options.vendorIds?.length) q = q.in('vendor_id', options.vendorIds)
    if (options.jobIds?.length)    q = q.in('job_id',    options.jobIds)

    const { data } = await q.order('order_date', { ascending: true })
    pos = (data ?? []) as unknown as PORow[]
    for (const po of pos) {
      if (po.job_id) allJobIds.add(po.job_id)
      if (po.created_by) allUserIds.add(po.created_by)
    }
  }

  // ── 3. Receiving records ─────────────────────────────────────────────
  type RecvRow = {
    id: string; po_id: string; received_by: string | null; received_at: string | null
    line_items: Array<{ line_id: string; status: string; quantity_received: number }>
  }
  type RecvPORow = {
    po_id: string; po_number: string | null; job_id: string | null; vendor_id: string | null
    vendors: { vendor_name_display: string | null; vendor_name_extracted: string | null } | null
  }
  let recvRecords: RecvRow[] = []
  const recvPoMap      = new Map<string, RecvPORow>()
  const recvPoLineMap  = new Map<string, { description: string | null; quantity_ordered: number | null }>()

  if (includeReceiving) {
    let q = supabase
      .from('receiving_records')
      .select('id, po_id, received_by, received_at, line_items')
      .eq('company_id', companyId)

    if (options.dateStart) q = q.gte('received_at', options.dateStart)
    if (options.dateEnd)   q = q.lte('received_at', options.dateEnd + 'T23:59:59')

    const { data } = await q.order('received_at', { ascending: true })
    recvRecords = (data ?? []) as RecvRow[]

    if (recvRecords.length > 0) {
      const recvPoIds = [...new Set(recvRecords.map(r => r.po_id))]

      let posQ = supabase
        .from('purchase_orders')
        .select(`
          po_id, po_number, job_id, vendor_id,
          vendors!purchase_orders_vendor_id_fkey(vendor_name_display, vendor_name_extracted)
        `)
        .in('po_id', recvPoIds)
        .not('job_id', 'is', null)

      if (options.vendorIds?.length) posQ = posQ.in('vendor_id', options.vendorIds)
      if (options.jobIds?.length)    posQ = posQ.in('job_id',    options.jobIds)

      const { data: recvPos } = await posQ
      for (const po of (recvPos ?? []) as unknown as RecvPORow[]) {
        recvPoMap.set(po.po_id, po)
        if (po.job_id) allJobIds.add(po.job_id)
      }

      const { data: poLines } = await supabase
        .from('po_line_items')
        .select('line_id, description, quantity_ordered')
        .in('po_id', recvPoIds)

      for (const l of poLines ?? []) {
        recvPoLineMap.set(l.line_id, {
          description: l.description,
          quantity_ordered: l.quantity_ordered,
        })
      }

      for (const r of recvRecords)
        if (r.received_by) allUserIds.add(r.received_by)
    }
  }

  // ── 4. Job details ───────────────────────────────────────────────────
  const targetJobIds = options.jobIds?.length
    ? new Set(options.jobIds.filter(id => allJobIds.has(id)))
    : allJobIds

  if (targetJobIds.size === 0) {
    return { sections: [], include: { pos: includePOs, receiving: includeReceiving, invoiced: includeInvoiced }, generatedAt: new Date().toISOString(), dateRangeStart: options.dateStart ?? null, dateRangeEnd: options.dateEnd ?? null }
  }

  const { data: jobRows } = await supabase
    .from('qb_jobs_cache')
    .select('qb_job_id, job_number, job_name, customer_name')
    .eq('company_id', companyId)
    .in('qb_job_id', [...targetJobIds])

  const jobMap = new Map(jobRows?.map(j => [j.qb_job_id, j]) ?? [])

  // ── 5. User names ────────────────────────────────────────────────────
  const userNameMap = new Map<string, string>()
  if (allUserIds.size > 0) {
    try {
      const { data: { users } } = await supabase.auth.admin.listUsers({ perPage: 1000 })
      for (const u of users) {
        const meta = u.user_metadata as Record<string, string> | undefined
        const name = meta?.full_name ?? meta?.name ?? u.email?.split('@')[0] ?? 'Unknown'
        userNameMap.set(u.id, name)
      }
    } catch { /* non-fatal */ }
  }

  // ── Helper ───────────────────────────────────────────────────────────
  function getOrCreate(jobId: string): ExportJobSection {
    let s = jobSections.get(jobId)
    if (!s) {
      const info = jobMap.get(jobId)
      s = {
        jobId,
        jobNumber:    info?.job_number    ?? null,
        jobName:      info?.job_name      ?? null,
        customerName: info?.customer_name ?? null,
        poRecords: [], receivingRecords: [], invoicedRecords: [],
        totalInvoiced: 0,
      }
      jobSections.set(jobId, s)
    }
    return s
  }

  // ── 6. Populate invoiced ─────────────────────────────────────────────
  for (const bill of bills) {
    const vendor = bill.vendors
    const vendorName = vendor?.vendor_name_display ?? vendor?.vendor_name_extracted ?? 'Unknown Vendor'

    const lines = bill.bill_line_items
      .filter(li => !li.is_tax_line && li.job_id && targetJobIds.has(li.job_id))
      .sort((a, b) => a.sort_order - b.sort_order)

    const linesByJob = new Map<string, typeof lines>()
    for (const li of lines) {
      const arr = linesByJob.get(li.job_id!) ?? []
      arr.push(li)
      linesByJob.set(li.job_id!, arr)
    }

    for (const [jobId, jobLines] of linesByJob) {
      const section = getOrCreate(jobId)
      const total = jobLines.reduce((s, li) => s + Number(li.extended_cost ?? 0), 0)
      section.invoicedRecords.push({
        vendorName,
        invoiceNumber: bill.invoice_number,
        invoiceDate:   bill.invoice_date,
        lines: jobLines.map(li => ({
          description:  li.description,
          unitCost:     li.unit_cost     != null ? Number(li.unit_cost)     : null,
          extendedCost: li.extended_cost != null ? Number(li.extended_cost) : null,
          quantity:     li.quantity      != null ? Number(li.quantity)      : null,
        })),
        total,
      })
      section.totalInvoiced += total
    }
  }

  // ── 7. Populate POs ──────────────────────────────────────────────────
  for (const po of pos) {
    if (!po.job_id || !targetJobIds.has(po.job_id)) continue
    const vendor = po.vendors
    const vendorName = vendor?.vendor_name_display ?? vendor?.vendor_name_extracted ?? 'Unknown Vendor'
    const section = getOrCreate(po.job_id)

    section.poRecords.push({
      vendorName,
      poNumber:  po.po_number,
      orderDate: po.order_date,
      orderedBy: po.created_by ? (userNameMap.get(po.created_by) ?? null) : null,
      lines: po.po_line_items
        .sort((a, b) => a.sort_order - b.sort_order)
        .map(l => ({
          description:   l.description,
          quantityOrdered: l.quantity_ordered != null ? Number(l.quantity_ordered) : null,
          unitCost:        l.unit_cost        != null ? Number(l.unit_cost)        : null,
        })),
    })
  }

  // ── 8. Populate receiving ────────────────────────────────────────────
  for (const record of recvRecords) {
    const po = recvPoMap.get(record.po_id)
    if (!po?.job_id || !targetJobIds.has(po.job_id)) continue
    const vendor = po.vendors
    const vendorName = vendor?.vendor_name_display ?? vendor?.vendor_name_extracted ?? 'Unknown Vendor'
    const section = getOrCreate(po.job_id)

    section.receivingRecords.push({
      vendorName,
      poNumber:   po.po_number,
      receivedAt: record.received_at,
      receivedBy: record.received_by ? (userNameMap.get(record.received_by) ?? null) : null,
      lines: (record.line_items ?? []).map(rl => {
        const poLine = recvPoLineMap.get(rl.line_id)
        return {
          description:     poLine?.description  ?? null,
          quantityOrdered: poLine?.quantity_ordered != null ? Number(poLine.quantity_ordered) : null,
          quantityReceived: Number(rl.quantity_received) || 0,
          status: (rl.status as 'received' | 'partial' | 'not_received') || 'not_received',
        }
      }),
    })
  }

  return {
    sections: [...jobSections.values()]
      .filter(s => s.poRecords.length > 0 || s.receivingRecords.length > 0 || s.invoicedRecords.length > 0)
      .sort((a, b) => (a.jobNumber ?? '').localeCompare(b.jobNumber ?? '')),
    include: { pos: includePOs, receiving: includeReceiving, invoiced: includeInvoiced },
    generatedAt:    new Date().toISOString(),
    dateRangeStart: options.dateStart ?? null,
    dateRangeEnd:   options.dateEnd   ?? null,
  }
}

// ── Formatting helpers ─────────────────────────────────────────────────

export function formatCurrency(amount: number | null): string {
  if (amount == null) return ''
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  const d = new Date(dateStr.length > 10 ? dateStr : dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
