import { createClient } from '@/lib/supabase/server'
import { disconnectQuickBooks } from './actions'

type Company = {
  company_id: string
  name: string
  qb_connection_status: string | null
  qb_realm_id: string | null
  qb_type: string | null
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ qb_connected?: string; qb_error?: string }>
}) {
  const { qb_connected, qb_error } = await searchParams
  const supabase = await createClient()

  const { data } = await supabase
    .from('companies')
    .select('company_id, name, qb_connection_status, qb_realm_id, qb_type')
    .single()

  const company = data as Company | null
  const isConnected = company?.qb_connection_status === 'connected'

  return (
    <div>
      {/* Page header */}
      <div className="sticky top-0 z-10 border-b border-gray-200 bg-white px-10 py-4">
        <h1 className="text-xl font-semibold text-gray-900">Settings</h1>
        <p className="mt-0.5 text-sm text-gray-400">Manage your integrations and account</p>
      </div>

      <div className="px-10 py-6 max-w-3xl space-y-6">
        {/* Success / error banners */}
        {qb_connected === 'true' && (
          <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800 ring-1 ring-green-200">
            QuickBooks connected successfully.
          </div>
        )}
        {qb_error && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-200">
            {errorMessage(qb_error)}
          </div>
        )}

        {/* QuickBooks integration card */}
        <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="px-6 py-5 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900">QuickBooks Online</h2>
            <p className="mt-0.5 text-sm text-gray-500">
              Connect your QuickBooks Online company to sync vendors, jobs, and push bills.
            </p>
          </div>

          <div className="px-6 py-5 flex items-center justify-between gap-4">
            {isConnected ? (
              <>
                <div className="flex items-center gap-3">
                  <span className="flex h-2.5 w-2.5 rounded-full bg-green-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Connected</p>
                    {company?.qb_realm_id && (
                      <p className="text-xs text-gray-400">Company ID: {company.qb_realm_id}</p>
                    )}
                  </div>
                </div>
                <form
                  action={async () => {
                    'use server'
                    if (company) await disconnectQuickBooks(company.company_id)
                  }}
                >
                  <button
                    type="submit"
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Disconnect
                  </button>
                </form>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <span className="flex h-2.5 w-2.5 rounded-full bg-gray-300" />
                  <p className="text-sm text-gray-500">Not connected</p>
                </div>
                <a
                  href="/api/quickbooks/connect"
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
                >
                  Connect QuickBooks
                </a>
              </>
            )}
          </div>
        </section>

        {/* Email capture placeholder */}
        <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="px-6 py-5 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900">Email Capture</h2>
            <p className="mt-0.5 text-sm text-gray-500">
              Forward vendor invoices to your BillFlow inbox address.
            </p>
          </div>
          <div className="px-6 py-5">
            {company?.name ? (
              <div className="flex items-center gap-3">
                <code className="rounded-md bg-gray-100 px-3 py-1.5 text-sm font-mono text-gray-800">
                  {company.company_id.slice(0, 8)}@billflow.app
                </code>
                <span className="text-xs text-gray-400">Forward invoices here</span>
              </div>
            ) : (
              <p className="text-sm text-gray-400">Set up your company to get your capture address.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

function errorMessage(code: string): string {
  const messages: Record<string, string> = {
    access_denied:        'QuickBooks authorization was cancelled.',
    missing_params:       'Invalid response from QuickBooks. Please try again.',
    invalid_state:        'Security check failed. Please try connecting again.',
    token_exchange_failed: 'QuickBooks token exchange failed. Check your app credentials.',
    storage_failed:       'Failed to save QuickBooks connection. Please try again.',
    no_company:           'No company found. Please contact support.',
  }
  return messages[code] ?? 'An error occurred connecting QuickBooks.'
}
