import { createServiceClient } from '@/lib/supabase/service'

export type ExportLineItem = {
  description: string | null
  unit_cost: number | null
  extended_cost: number | null
  quantity: number | null
}

export type ExportVendorSection = {
  vendorName: string
  invoiceNumber: string | null
  invoiceDate: string | null
  lineItems: ExportLineItem[]
  vendorTotal: number
}

export type ExportJobSection = {
  jobId: string
  jobNumber: string | null
  jobName: string | null
  customerName: string | null
  vendors: ExportVendorSection[]
  jobTotal: number
}

export type ExportData = {
  sections: ExportJobSection[]
  generatedAt: string
  dateRangeStart: string | null
  dateRangeEnd: string | null
}

export async function getExportData(
  companyId: string,
  options: {
    dateStart?: string
    dateEnd?: string
    vendorIds?: string[]
    jobIds?: string[]
  }
): Promise<ExportData> {
  const supabase = createServiceClient()

  let query = supabase
    .from('bills')
    .select(`
      bill_id, invoice_number, invoice_date, total,
      vendors!bills_vendor_id_fkey ( vendor_id, vendor_name_display, vendor_name_extracted ),
      bill_line_items (
        line_id, description, unit_cost, extended_cost, quantity, job_id, sort_order, is_tax_line
      )
    `)
    .eq('company_id', companyId)
    .eq('status', 'published')

  if (options.dateStart) query = query.gte('invoice_date', options.dateStart)
  if (options.dateEnd) query = query.lte('invoice_date', options.dateEnd)
  if (options.vendorIds?.length) query = query.in('vendor_id', options.vendorIds)

  const { data: bills } = await query.order('invoice_date', { ascending: true })
  if (!bills || bills.length === 0) {
    return { sections: [], generatedAt: new Date().toISOString(), dateRangeStart: options.dateStart ?? null, dateRangeEnd: options.dateEnd ?? null }
  }

  // Collect all job IDs from line items
  const allJobIds = new Set<string>()
  for (const bill of bills) {
    for (const li of (bill as Record<string, unknown>).bill_line_items as Array<{ job_id: string | null }>) {
      if (li.job_id) allJobIds.add(li.job_id)
    }
  }

  // Filter by job IDs if specified
  const targetJobIds = options.jobIds?.length ? new Set(options.jobIds) : allJobIds

  // Fetch job details
  const { data: jobs } = await supabase
    .from('qb_jobs_cache')
    .select('qb_job_id, job_number, job_name, customer_name')
    .eq('company_id', companyId)
    .in('qb_job_id', [...targetJobIds])

  const jobMap = new Map(jobs?.map(j => [j.qb_job_id, j]) ?? [])

  // Group: job → vendor → line items
  const jobSections = new Map<string, ExportJobSection>()

  for (const bill of bills) {
    const b = bill as Record<string, unknown>
    const vendor = b.vendors as { vendor_id: string; vendor_name_display: string | null; vendor_name_extracted: string } | null
    const vendorName = vendor?.vendor_name_display ?? vendor?.vendor_name_extracted ?? 'Unknown Vendor'
    const lineItems = (b.bill_line_items as Array<{
      line_id: string; description: string | null; unit_cost: number | null;
      extended_cost: number | null; quantity: number | null; job_id: string | null;
      sort_order: number; is_tax_line: boolean | null;
    }>)
      .filter(li => !li.is_tax_line)
      .sort((a, c) => a.sort_order - c.sort_order)

    // Group line items by job
    const linesByJob = new Map<string, typeof lineItems>()
    for (const li of lineItems) {
      if (!li.job_id || !targetJobIds.has(li.job_id)) continue
      const existing = linesByJob.get(li.job_id) ?? []
      existing.push(li)
      linesByJob.set(li.job_id, existing)
    }

    for (const [jobId, jobLines] of linesByJob) {
      let jobSection = jobSections.get(jobId)
      if (!jobSection) {
        const jobInfo = jobMap.get(jobId)
        jobSection = {
          jobId,
          jobNumber: jobInfo?.job_number ?? null,
          jobName: jobInfo?.job_name ?? null,
          customerName: jobInfo?.customer_name ?? null,
          vendors: [],
          jobTotal: 0,
        }
        jobSections.set(jobId, jobSection)
      }

      const vendorTotal = jobLines.reduce((sum, li) => sum + (li.extended_cost ?? 0), 0)
      jobSection.vendors.push({
        vendorName,
        invoiceNumber: b.invoice_number as string | null,
        invoiceDate: b.invoice_date as string | null,
        lineItems: jobLines.map(li => ({
          description: li.description,
          unit_cost: li.unit_cost,
          extended_cost: li.extended_cost,
          quantity: li.quantity,
        })),
        vendorTotal,
      })
      jobSection.jobTotal += vendorTotal
    }
  }

  return {
    sections: [...jobSections.values()].sort((a, b) => (a.jobNumber ?? '').localeCompare(b.jobNumber ?? '')),
    generatedAt: new Date().toISOString(),
    dateRangeStart: options.dateStart ?? null,
    dateRangeEnd: options.dateEnd ?? null,
  }
}

export function formatCurrency(amount: number | null): string {
  if (amount == null) return ''
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
