import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getJobProfitability, type JobProfitabilityRow } from '@/lib/quickbooks/profitability'
import { JobsTable } from './jobs-table'
import Link from 'next/link'

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab } = await searchParams
  const showClosed = tab === 'closed'

  const supabase = await createClient()

  const { data: company } = await supabase
    .from('companies')
    .select('company_id, qb_connection_status, qb_last_sync')
    .single()

  let rows: JobProfitabilityRow[] = []
  let errorMsg: string | null = null

  if (company?.company_id && company.qb_connection_status === 'connected') {
    try {
      rows = await getJobProfitability(company.company_id)
    } catch (err) {
      errorMsg = err instanceof Error ? err.message : 'Failed to load profitability data'
    }
  }

  // Fetch closed jobs from the cache
  let closedJobs: { qb_job_id: string; job_number: string | null; job_name: string | null; customer_name: string | null }[] = []
  if (company?.company_id) {
    const svc = createServiceClient()
    const { data } = await svc
      .from('qb_jobs_cache')
      .select('qb_job_id, job_number, job_name, customer_name')
      .eq('company_id', company.company_id)
      .eq('status', 'closed')
      .order('job_number', { ascending: true })
    closedJobs = data ?? []
  }

  const lastSync = company?.qb_last_sync
    ? new Date(company.qb_last_sync).toLocaleString()
    : null

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '6px 16px', fontSize: 13, fontWeight: active ? 500 : 400,
    color: active ? '#1A3D2B' : 'var(--color-text-secondary)',
    borderBottom: active ? '2px solid #2DB87A' : '2px solid transparent',
    textDecoration: 'none', cursor: 'pointer', background: 'none', border: 'none',
    borderBottomStyle: 'solid', borderBottomWidth: 2,
    borderBottomColor: active ? '#2DB87A' : 'transparent',
  })

  return (
    <div className="flex flex-col h-full">
      <div
        className="flex-none flex items-center justify-between px-5 py-[14px]"
        style={{ background: 'white', borderBottom: '0.5px solid var(--color-border-tertiary)' }}
      >
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 500, color: 'var(--color-text-primary)' }}>Jobs</h1>
          <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>
            {showClosed ? 'Closed jobs — hidden from tagging dropdowns' : 'Active jobs with 30-day profitability data'}
          </p>
        </div>
        {lastSync && (
          <p style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>QB synced {lastSync}</p>
        )}
      </div>

      {/* Tabs */}
      <div
        className="flex-none flex items-center gap-0 px-5"
        style={{ background: 'white', borderBottom: '0.5px solid var(--color-border-tertiary)' }}
      >
        <Link href="/jobs" style={tabStyle(!showClosed)}>Active</Link>
        <Link href="/jobs?tab=closed" style={tabStyle(showClosed)}>
          Closed{closedJobs.length > 0 ? ` (${closedJobs.length})` : ''}
        </Link>
      </div>

      <div className="flex-1 overflow-auto px-5 py-5">
        {showClosed ? (
          <JobsTable rows={[]} closedJobs={closedJobs} showClosed />
        ) : company?.qb_connection_status !== 'connected' ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <i className="ti ti-plug" style={{ fontSize: 48, color: 'var(--color-text-tertiary)' }} />
            <h2 style={{ fontSize: 16, fontWeight: 500, color: 'var(--color-text-primary)', marginTop: 16 }}>
              QuickBooks not connected
            </h2>
            <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 6, maxWidth: 360 }}>
              Connect QuickBooks in Settings to see job data.
            </p>
            <Link href="/settings" style={{ marginTop: 16, background: '#2DB87A', color: 'white', borderRadius: 6, padding: '8px 20px', fontSize: 13, fontWeight: 500, textDecoration: 'none' }}>
              Go to Settings
            </Link>
          </div>
        ) : errorMsg ? (
          <div className="flex items-center gap-3 px-4 py-3" style={{ background: '#FEF2F2', border: '0.5px solid #FECACA', borderRadius: 8 }}>
            <i className="ti ti-alert-circle" style={{ fontSize: 16, color: '#DC2626' }} />
            <p style={{ fontSize: 13, color: '#991B1B' }}>{errorMsg}</p>
          </div>
        ) : (
          <JobsTable rows={rows} closedJobs={closedJobs} showClosed={false} />
        )}
      </div>
    </div>
  )
}
