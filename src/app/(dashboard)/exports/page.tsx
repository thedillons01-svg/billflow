import { createClient } from '@/lib/supabase/server'
import { ExportForm } from './export-form'

export default async function ExportsPage() {
  const supabase = await createClient()

  const { data: company } = await supabase.from('companies').select('company_id').single()

  const [{ data: vendors }, { data: jobs }, { data: recentExports }] = await Promise.all([
    company
      ? supabase.from('vendors')
          .select('vendor_id, vendor_name_display, vendor_name_extracted')
          .eq('company_id', company.company_id)
          .order('vendor_name_extracted')
      : { data: [] },
    company
      ? supabase.from('qb_jobs_cache')
          .select('qb_job_id, job_number, job_name, customer_name')
          .eq('company_id', company.company_id)
          .order('cached_at', { ascending: false })
          .limit(200)
      : { data: [] },
    company
      ? supabase.from('exports')
          .select('id, export_date, format, date_range_start, date_range_end')
          .eq('company_id', company.company_id)
          .order('export_date', { ascending: false })
          .limit(20)
      : { data: [] },
  ])

  const vendorOptions = (vendors ?? []).map(v => ({
    id: v.vendor_id,
    label: v.vendor_name_display ?? v.vendor_name_extracted,
  }))

  const jobOptions = (jobs ?? []).map(j => ({
    id: j.qb_job_id,
    label: [j.job_number, j.job_name, j.customer_name].filter(Boolean).join(' – '),
  }))

  return (
    <div>
      <div className="sticky top-0 z-10 border-b border-gray-200 bg-white px-10 py-4">
        <h1 className="text-xl font-semibold text-gray-900">FSM Materials Entry Export</h1>
        <p className="mt-0.5 text-sm text-gray-400">
          Export published bills grouped by job for entry into your field service platform
        </p>
      </div>

      <div className="px-10 py-6 max-w-3xl space-y-6">
        <ExportForm vendors={vendorOptions} jobs={jobOptions} />

        {/* Export history */}
        {recentExports && recentExports.length > 0 && (
          <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900">Recent Exports</h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs font-medium text-gray-400 uppercase tracking-wide">
                  <th className="px-6 py-2.5 text-left">Date</th>
                  <th className="px-4 py-2.5 text-left">Date Range</th>
                  <th className="px-4 py-2.5 text-left">Format</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recentExports.map(exp => (
                  <tr key={exp.id} className="text-gray-700">
                    <td className="px-6 py-2.5 text-gray-900">
                      {new Date(exp.export_date).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric',
                        hour: 'numeric', minute: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs">
                      {exp.date_range_start && exp.date_range_end
                        ? `${exp.date_range_start} – ${exp.date_range_end}`
                        : exp.date_range_start ?? exp.date_range_end ?? 'All dates'}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 uppercase">
                        {exp.format}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </div>
    </div>
  )
}
