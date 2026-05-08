import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const VENDOR_SEEDS = [
  {
    vendor_name_extracted: 'Gensco Inc.',
    vendor_name_display: 'Gensco Inc.',
    invoices_processed: 12,
    confidence_score: 0.95,
    confidence_display: 'high',
    auto_publish_enabled: true,
    hold_for_job_match: false,
    gl_account_source: 'billflow_override',
    last_invoice_date: '2026-05-03',
  },
  {
    vendor_name_extracted: 'Ferguson Enterprises',
    vendor_name_display: 'Ferguson Enterprises',
    invoices_processed: 7,
    confidence_score: 0.88,
    confidence_display: 'high',
    auto_publish_enabled: false,
    hold_for_job_match: false,
    gl_account_source: 'not_set',
    last_invoice_date: '2026-04-30',
  },
  {
    vendor_name_extracted: 'Winsupply of Portland',
    vendor_name_display: 'Winsupply Portland',
    invoices_processed: 3,
    confidence_score: 0.72,
    confidence_display: 'medium',
    auto_publish_enabled: false,
    hold_for_job_match: false,
    gl_account_source: 'not_set',
    last_invoice_date: '2026-05-01',
  },
  {
    vendor_name_extracted: 'Johnstone Supply',
    vendor_name_display: 'Johnstone Supply',
    invoices_processed: 21,
    confidence_score: 0.92,
    confidence_display: 'high',
    auto_publish_enabled: true,
    hold_for_job_match: true,
    gl_account_source: 'qb_default',
    last_invoice_date: '2026-05-02',
  },
  {
    vendor_name_extracted: 'National Refrigerants',
    vendor_name_display: 'National Refrigerants Inc.',
    invoices_processed: 1,
    confidence_score: null,
    confidence_display: 'low',
    auto_publish_enabled: false,
    hold_for_job_match: false,
    gl_account_source: 'not_set',
    last_invoice_date: '2026-05-04',
  },
]

async function main() {
  const { data: companies } = await supabase
    .from('companies')
    .select('company_id')
    .limit(1)

  const company = companies?.[0]
  if (!company) { console.error('No company found'); process.exit(1) }

  const companyId = company.company_id

  for (const seed of VENDOR_SEEDS) {
    const { data: existing } = await supabase
      .from('vendors')
      .select('vendor_id')
      .eq('company_id', companyId)
      .eq('vendor_name_extracted', seed.vendor_name_extracted)
      .single()

    if (existing) {
      console.log(`skip  ${seed.vendor_name_extracted} (exists)`)
      continue
    }

    const { error } = await supabase.from('vendors').insert({ ...seed, company_id: companyId })
    if (error) {
      console.error(`fail  ${seed.vendor_name_extracted}:`, error.message)
    } else {
      console.log(`✓     ${seed.vendor_name_extracted}`)
    }
  }

  // Link vendors back to matching bills by vendor_name_raw
  const { data: vendors } = await supabase
    .from('vendors')
    .select('vendor_id, vendor_name_extracted')
    .eq('company_id', companyId)

  for (const vendor of vendors ?? []) {
    await supabase
      .from('bills')
      .update({ vendor_id: vendor.vendor_id })
      .eq('company_id', companyId)
      .eq('vendor_name_raw', vendor.vendor_name_extracted)
      .is('vendor_id', null)
  }

  console.log('\nVendors seeded and linked to bills.')
}

main()
