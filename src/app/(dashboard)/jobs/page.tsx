import { createClient } from '@/lib/supabase/server'
import { getJobProfitability, type JobProfitabilityRow } from '@/lib/quickbooks/profitability'
import { JobsTable } from './jobs-table'
import Link from 'next/link'

export default async function JobsPage() {
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

  const lastSync = company?.qb_last_sync
    ? new Date(company.qb_last_sync).toLocaleString()
    : null

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div
        className="flex-none flex items-center justify-between px-5 py-[14px]"
        style={{ background: 'white', borderBottom: '0.5px solid var(--color-border-tertiary)' }}
      >
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 500, color: 'var(--color-text-primary)' }}>Job Profitability</h1>
          <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>
            Jobs with activity in the last 30 days — revenue from QuickBooks, material costs from Purchasomatic
          </p>
        </div>
        {lastSync && (
          <p style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>QB synced {lastSync}</p>
        )}
      </div>

      <div className="flex-1 overflow-auto px-5 py-5">
        {company?.qb_connection_status !== 'connected' ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <i className="ti ti-plug" style={{ fontSize: 48, color: 'var(--color-text-tertiary)' }} />
            <h2 style={{ fontSize: 16, fontWeight: 500, color: 'var(--color-text-primary)', marginTop: 16 }}>
              QuickBooks not connected
            </h2>
            <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 6, maxWidth: 360 }}>
              Connect QuickBooks in Settings to see revenue and profitability data alongside material costs.
            </p>
            <Link
              href="/settings"
              style={{
                marginTop: 16, background: '#2DB87A', color: 'white',
                borderRadius: 6, padding: '8px 20px',
                fontSize: 13, fontWeight: 500, textDecoration: 'none',
              }}
            >
              Go to Settings
            </Link>
          </div>
        ) : errorMsg ? (
          <div
            className="flex items-center gap-3 px-4 py-3"
            style={{ background: '#FEF2F2', border: '0.5px solid #FECACA', borderRadius: 8 }}
          >
            <i className="ti ti-alert-circle" style={{ fontSize: 16, color: '#DC2626' }} />
            <p style={{ fontSize: 13, color: '#991B1B' }}>{errorMsg}</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <i className="ti ti-chart-bar" style={{ fontSize: 48, color: 'var(--color-text-tertiary)' }} />
            <h2 style={{ fontSize: 16, fontWeight: 500, color: 'var(--color-text-primary)', marginTop: 16 }}>
              No job activity in the last 30 days
            </h2>
            <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 6, maxWidth: 380 }}>
              Bills published to QuickBooks with job assignments will appear here.
            </p>
          </div>
        ) : (
          <JobsTable rows={rows} />
        )}
      </div>
    </div>
  )
}
