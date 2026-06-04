import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { ExportForm } from './export-form'

export default async function ExportsPage() {
  const supabase = await createClient()

  const { data: company } = await supabase
    .from('companies')
    .select('company_id, job_tagging_level')
    .single()

  const svc = createServiceClient()

  const [{ data: vendors }, { data: recentExports }, jobsWithActivity] = await Promise.all([
    company
      ? supabase.from('vendors')
          .select('vendor_id, vendor_name_display, vendor_name_extracted')
          .eq('company_id', company.company_id)
          .order('vendor_name_extracted')
      : { data: [] },
    company
      ? supabase.from('exports')
          .select('id, export_date, format, date_range_start, date_range_end')
          .eq('company_id', company.company_id)
          .order('export_date', { ascending: false })
          .limit(20)
      : { data: [] },
    // Jobs that have at least one transaction, sorted by most recent activity
    company ? (async () => {
      const taggingLevel = company.job_tagging_level ?? 'sub_customers_only'
      let q = svc
        .from('qb_jobs_cache')
        .select('qb_job_id, job_number, job_name, customer_name, status, is_customer')
        .eq('company_id', company.company_id)
        .order('job_number', { ascending: true })
        .limit(500)
      if (taggingLevel === 'sub_customers_only') q = q.eq('is_customer', false)
      else if (taggingLevel === 'customers_only') q = q.eq('is_customer', true)
      const { data } = await q
      return data ?? []
    })() : Promise.resolve([]),
  ])

  const vendorOptions = (vendors ?? []).map(v => ({
    id: v.vendor_id,
    label: v.vendor_name_display ?? v.vendor_name_extracted ?? '',
  }))

  type JobRow = { qb_job_id: string; job_number: string | null; job_name: string | null; customer_name: string | null; status: string; is_customer: boolean }
  const jobOptions = (jobsWithActivity as JobRow[]).map(j => ({
    id: j.qb_job_id,
    label: [j.job_number, j.job_name, j.customer_name].filter(Boolean).join(' – '),
    status: j.status,
  }))

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div
        className="flex-none flex items-center justify-between px-5 py-[14px]"
        style={{ background: 'white', borderBottom: '0.5px solid var(--color-border-tertiary)' }}
      >
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 500, color: 'var(--color-text-primary)' }}>FSM Materials Export</h1>
          <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>
            Export published bills grouped by job for entry into your field service platform
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-5 py-5">
        <div style={{ maxWidth: 700 }} className="space-y-5">

          <ExportForm
            vendors={vendorOptions}
            jobs={jobOptions}
            lastExportDate={recentExports?.[0]?.export_date ?? null}
          />


          {/* Export history */}
          {recentExports && recentExports.length > 0 && (
            <div
              style={{
                background: 'white',
                border: '0.5px solid var(--color-border-tertiary)',
                borderRadius: 8,
                overflow: 'hidden',
              }}
            >
              <div className="px-5 py-4" style={{ borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
                <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)' }}>Export History</p>
              </div>
              <div
                className="grid px-5 py-2"
                style={{ gridTemplateColumns: '1.5fr 1.5fr 80px', borderBottom: '0.5px solid var(--color-border-tertiary)' }}
              >
                {['Date', 'Date Range', 'Format'].map(h => (
                  <span key={h} style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-secondary)' }}>
                    {h}
                  </span>
                ))}
              </div>
              {recentExports.map((exp, i) => (
                <div
                  key={exp.id}
                  className="grid items-center px-5 py-[10px]"
                  style={{
                    gridTemplateColumns: '1.5fr 1.5fr 80px',
                    borderBottom: i < recentExports.length - 1 ? '0.5px solid var(--color-border-tertiary)' : 'none',
                    background: i % 2 === 0 ? 'white' : 'var(--color-background-secondary)',
                  }}
                >
                  <span style={{ fontSize: 13, color: 'var(--color-text-primary)' }}>
                    {new Date(exp.export_date).toLocaleString()}
                  </span>
                  <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                    {exp.date_range_start && exp.date_range_end
                      ? `${exp.date_range_start} – ${exp.date_range_end}`
                      : exp.date_range_start ?? exp.date_range_end ?? 'All dates'}
                  </span>
                  <span
                    style={{
                      display: 'inline-block',
                      background: 'var(--color-background-secondary)',
                      color: 'var(--color-text-secondary)',
                      borderRadius: 4, padding: '2px 8px',
                      fontSize: 10, fontWeight: 500, textTransform: 'uppercase',
                    }}
                  >
                    {exp.format}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
