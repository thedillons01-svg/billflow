import { getQBClient } from './client'
import { createServiceClient } from '@/lib/supabase/service'

export type JobProfitabilityRow = {
  qb_job_id: string
  job_number: string | null
  job_name: string | null
  customer_name: string | null
  revenue: number | null
  material_cost: number | null
  gross_profit: number | null
  margin_pct: number | null
}

export async function getJobProfitability(companyId: string): Promise<JobProfitabilityRow[]> {
  const supabase = createServiceClient()

  // 30-day window
  const end = new Date()
  const start = new Date(end)
  start.setDate(start.getDate() - 30)
  const startStr = start.toISOString().slice(0, 10)
  const endStr = end.toISOString().slice(0, 10)

  // Pull material costs from Purchasomatic bills (published bills with line items)
  const { data: lineItems } = await supabase
    .from('bill_line_items')
    .select('job_id, extended_cost, bills!inner(status, invoice_date, company_id)')
    .eq('bills.company_id', companyId)
    .eq('bills.status', 'published')
    .gte('bills.invoice_date', startStr)
    .lte('bills.invoice_date', endStr)
    .not('job_id', 'is', null)

  const costByJob = new Map<string, number>()
  for (const li of lineItems ?? []) {
    if (!li.job_id) continue
    costByJob.set(li.job_id, (costByJob.get(li.job_id) ?? 0) + (li.extended_cost ?? 0))
  }

  // Pull jobs from cache
  const { data: jobs } = await supabase
    .from('qb_jobs_cache')
    .select('qb_job_id, job_number, job_name, customer_name, last_transaction_date')
    .eq('company_id', companyId)
    .order('last_transaction_date', { ascending: false, nullsFirst: false })

  if (!jobs || jobs.length === 0) return []

  // Try to get revenue from QB P&L report (optional — may fail if not connected)
  const revenueByJob = new Map<string, number>()
  try {
    const { qbReport } = await getQBClient(companyId)
    const report = await qbReport('ProfitAndLoss', {
      start_date: startStr,
      end_date: endStr,
      summarize_column_by: 'Customers',
    })
    // Parse QBO P&L report columns for revenue
    const columns = report?.Columns?.Column ?? []
    const rows = report?.Rows?.Row ?? []
    const customerIds = columns
      .map((col: Record<string, unknown>, idx: number) => ({ idx, metaData: col.MetaData as Array<Record<string, string>> ?? [] }))
      .filter((c: { metaData: Array<Record<string, string>> }) => c.metaData.some(m => m.Name === 'ID'))

    for (const row of rows) {
      if (row?.group === 'Income' || row?.type === 'Section') {
        const summaryRow = row?.Rows?.Row?.find((r: Record<string, unknown>) => r?.type === 'GrandTotal')
          ?? row?.Summary
        if (!summaryRow) continue
        const colData = summaryRow.ColData as Array<Record<string, string>> ?? []
        for (const c of customerIds) {
          const val = parseFloat(colData[c.idx]?.value ?? '0')
          const meta = c.metaData.find((m: Record<string, string>) => m.Name === 'ID')
          if (meta?.Value && !isNaN(val)) {
            revenueByJob.set(meta.Value, (revenueByJob.get(meta.Value) ?? 0) + val)
          }
        }
      }
    }
  } catch {
    // QB not connected or report failed — show costs only
  }

  // Merge into rows — show jobs with any Purchasomatic cost or QB activity
  const activeJobIds = new Set([...costByJob.keys(), ...revenueByJob.keys()])
  const result: JobProfitabilityRow[] = []

  for (const job of jobs) {
    const hasCost = costByJob.has(job.qb_job_id)
    const hasRevenue = revenueByJob.has(job.qb_job_id)
    if (!hasCost && !hasRevenue) continue

    const materialCost = costByJob.get(job.qb_job_id) ?? null
    const revenue = revenueByJob.get(job.qb_job_id) ?? null
    const grossProfit = revenue != null && materialCost != null ? revenue - materialCost : null
    const marginPct = grossProfit != null && revenue != null && revenue !== 0
      ? (grossProfit / revenue) * 100
      : null

    result.push({
      qb_job_id: job.qb_job_id,
      job_number: job.job_number,
      job_name: job.job_name,
      customer_name: job.customer_name,
      revenue,
      material_cost: materialCost,
      gross_profit: grossProfit,
      margin_pct: marginPct,
    })
  }

  // Also include jobs with Purchasomatic cost even if not in QB P&L
  for (const [jobId, cost] of costByJob) {
    if (!activeJobIds.has(jobId)) continue
    if (result.find(r => r.qb_job_id === jobId)) continue
    const job = jobs.find(j => j.qb_job_id === jobId)
    if (!job) continue
    result.push({
      qb_job_id: jobId,
      job_number: job.job_number,
      job_name: job.job_name,
      customer_name: job.customer_name,
      revenue: null,
      material_cost: cost,
      gross_profit: null,
      margin_pct: null,
    })
  }

  return result.sort((a, b) => (b.material_cost ?? 0) - (a.material_cost ?? 0))
}
