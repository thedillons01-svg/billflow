import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  // Upsert a test company
  const { data: company, error: companyError } = await supabase
    .from('companies')
    .upsert({ name: 'Dillon HVAC & Mechanical', capture_email_prefix: 'dillon' }, { onConflict: 'capture_email_prefix' })
    .select('company_id')
    .single()

  if (companyError || !company) {
    console.error('Company upsert failed:', companyError)
    process.exit(1)
  }

  const companyId = company.company_id
  console.log('Company ID:', companyId)

  // Insert test bills
  const bills = [
    {
      company_id: companyId,
      vendor_name_raw: 'Gensco Inc.',
      invoice_number: 'GSC-2026-00891',
      invoice_date: '2026-04-28',
      total: 1842.75,
      status: 'draft',
      autopublish_hold_reason: null,
    },
    {
      company_id: companyId,
      vendor_name_raw: 'Ferguson Enterprises',
      invoice_number: 'FE-8842019',
      invoice_date: '2026-04-30',
      total: 534.20,
      status: 'ready',
      autopublish_hold_reason: null,
    },
    {
      company_id: companyId,
      vendor_name_raw: 'Winsupply of Portland',
      invoice_number: 'WIN-44512',
      invoice_date: '2026-05-01',
      total: 293.50,
      status: 'sync_error',
      autopublish_hold_reason: null,
    },
    {
      company_id: companyId,
      vendor_name_raw: 'Johnstone Supply',
      invoice_number: 'JS-2026-30041',
      invoice_date: '2026-05-02',
      total: 711.00,
      status: 'draft',
      autopublish_hold_reason: 'Auto-publish paused: job match confidence below threshold',
    },
    {
      company_id: companyId,
      vendor_name_raw: 'Gensco Inc.',
      invoice_number: 'GSC-2026-00902',
      invoice_date: '2026-05-03',
      total: 2108.40,
      status: 'pending_job_match',
      autopublish_hold_reason: null,
    },
    {
      company_id: companyId,
      vendor_name_raw: 'National Refrigerants',
      invoice_number: 'NR-10049922',
      invoice_date: '2026-05-04',
      total: 456.00,
      status: 'pending_job_match',
      autopublish_hold_reason: null,
    },
  ]

  const { error: billsError } = await supabase.from('bills').insert(bills)

  if (billsError) {
    console.error('Bills insert failed:', billsError)
    process.exit(1)
  }

  console.log(`Inserted ${bills.length} test bills.`)
}

main()
