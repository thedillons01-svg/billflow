import { createClient } from '@/lib/supabase/server'
import { VendorRow } from './vendor-row'

export default async function VendorsPage() {
  const supabase = await createClient()

  const { data: vendors } = await supabase
    .from('vendors')
    .select(`
      vendor_id, vendor_name_extracted, vendor_name_display,
      invoices_processed, confidence_display, last_invoice_date,
      auto_publish_enabled, hold_for_job_match, gl_account_source,
      qb_default_gl_account_id, billflow_gl_account_id
    `)
    .order('invoices_processed', { ascending: false })

  return (
    <div>
      <div className="sticky top-0 z-10 border-b border-gray-200 bg-white px-10 py-4">
        <h1 className="text-xl font-semibold text-gray-900">Vendors</h1>
        <p className="mt-0.5 text-sm text-gray-400">Manage vendor settings, GL accounts, and auto-publish rules</p>
      </div>

      <div className="px-10 py-6">
        {!vendors || vendors.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white px-8 py-16 text-center">
            <p className="text-sm font-medium text-gray-500">No vendors yet</p>
            <p className="mt-1 text-sm text-gray-400">Vendors are created automatically when invoices arrive via email.</p>
          </div>
        ) : (
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                  <th className="px-5 py-3">Vendor</th>
                  <th className="px-4 py-3">Invoices</th>
                  <th className="px-4 py-3">Confidence</th>
                  <th className="px-4 py-3">GL Account</th>
                  <th className="px-4 py-3">Auto-Publish</th>
                  <th className="px-4 py-3">Hold for Job</th>
                  <th className="px-4 py-3">Last Invoice</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(vendors as Parameters<typeof VendorRow>[0]['vendor'][]).map(v => (
                  <VendorRow key={v.vendor_id} vendor={v} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
