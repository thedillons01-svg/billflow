import { createClient } from '@/lib/supabase/server'
import { getJobProfitability, type JobProfitabilityRow } from '@/lib/quickbooks/profitability'
import { JobsTable } from './jobs-table'

export default async function JobsPage() {
  const supabase = await createClient()

  const { data: company } = await supabase
    .from('companies')
    .select('company_id, qb_connection_status, qb_last_sync')
    .single()

  let rows: JobProfitabilityRow[] = []
  let errorMsg: string | null = null

  if (company?.company_id) {
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
    <div>
      <div className="sticky top-0 z-10 border-b border-gray-200 bg-white px-10 py-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Job Profitability</h1>
            <p className="mt-0.5 text-sm text-gray-400">
              Jobs with activity in the last 30 days — revenue from QuickBooks, material costs from Purchasomatic
            </p>
          </div>
          {lastSync && (
            <p className="text-xs text-gray-400 mt-1">QB synced {lastSync}</p>
          )}
        </div>
      </div>

      <div className="px-10 py-6">
        {!company || company.qb_connection_status !== 'connected' ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white px-8 py-16 text-center">
            <p className="text-sm font-medium text-gray-500">QuickBooks not connected</p>
            <p className="mt-1 text-sm text-gray-400">
              Connect QuickBooks in{' '}
              <a href="/settings" className="text-blue-600 hover:underline">Settings</a>{' '}
              to see job profitability data.
            </p>
          </div>
        ) : errorMsg ? (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-200">
            {errorMsg}
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white px-8 py-16 text-center">
            <p className="text-sm font-medium text-gray-500">No job activity in the last 30 days</p>
            <p className="mt-1 text-sm text-gray-400">
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
