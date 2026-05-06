import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const BILL_SEEDS = [
  {
    vendor_name_raw: 'Gensco Inc.',
    invoice_number: 'GSC-2026-00891',
    invoice_date: '2026-04-28',
    total: 1842.75,
    status: 'draft',
    autopublish_hold_reason: null,
    lines: [
      { description: 'Carrier 24ACC636A003 3T Condenser', quantity: 1, unit_cost: 1450.00, extended_cost: 1450.00 },
      { description: 'R-410A Refrigerant 25lb cylinder',  quantity: 1, unit_cost:  189.75, extended_cost:  189.75 },
      { description: 'Copper line set 3/8" x 3/4" 25ft',  quantity: 1, unit_cost:  203.00, extended_cost:  203.00 },
    ],
  },
  {
    vendor_name_raw: 'Ferguson Enterprises',
    invoice_number: 'FE-8842019',
    invoice_date: '2026-04-30',
    total: 534.20,
    status: 'ready',
    autopublish_hold_reason: null,
    lines: [
      { description: '3/4" brass ball valve (10-pack)', quantity: 2, unit_cost:  87.50, extended_cost: 175.00 },
      { description: '1/2" copper tee (25-pack)',        quantity: 1, unit_cost:  68.40, extended_cost:  68.40 },
      { description: 'CPVC cement quart',                quantity: 3, unit_cost:  14.80, extended_cost:  44.40 },
      { description: 'Misc fittings and supplies',       quantity: 1, unit_cost: 246.40, extended_cost: 246.40 },
    ],
  },
  {
    vendor_name_raw: 'Winsupply of Portland',
    invoice_number: 'WIN-44512',
    invoice_date: '2026-05-01',
    total: 293.50,
    status: 'sync_error',
    autopublish_hold_reason: null,
    lines: [
      { description: 'Honeywell T6 Pro thermostat',  quantity: 2, unit_cost: 89.00, extended_cost: 178.00 },
      { description: '24V control transformer',      quantity: 1, unit_cost: 45.00, extended_cost:  45.00 },
      { description: '18/5 low voltage wire 50ft',   quantity: 2, unit_cost: 35.25, extended_cost:  70.50 },
    ],
  },
  {
    vendor_name_raw: 'Johnstone Supply',
    invoice_number: 'JS-2026-30041',
    invoice_date: '2026-05-02',
    total: 711.00,
    status: 'draft',
    autopublish_hold_reason: 'Auto-publish paused: job match confidence below threshold',
    lines: [
      { description: '20x25x1 MERV-8 filters (12-pack)', quantity: 3, unit_cost:  89.00, extended_cost: 267.00 },
      { description: 'Blower motor 1/2 HP',              quantity: 1, unit_cost: 312.00, extended_cost: 312.00 },
      { description: '45/5 MFD run capacitor',           quantity: 2, unit_cost:  22.00, extended_cost:  44.00 },
      { description: '40A 24V contactor',                quantity: 2, unit_cost:  44.00, extended_cost:  88.00 },
    ],
  },
  {
    vendor_name_raw: 'Gensco Inc.',
    invoice_number: 'GSC-2026-00902',
    invoice_date: '2026-05-03',
    total: 2108.40,
    status: 'pending_job_match',
    autopublish_hold_reason: null,
    lines: [
      { description: 'Lennox XC21-036 3T AC condenser', quantity: 1, unit_cost: 1820.00, extended_cost: 1820.00 },
      { description: 'Disconnect box 60A',              quantity: 1, unit_cost:  145.00, extended_cost:  145.00 },
      { description: 'R-410A refrigerant 25lb',         quantity: 1, unit_cost:  143.40, extended_cost:  143.40 },
    ],
  },
  {
    vendor_name_raw: 'National Refrigerants',
    invoice_number: 'NR-10049922',
    invoice_date: '2026-05-04',
    total: 456.00,
    status: 'pending_job_match',
    autopublish_hold_reason: null,
    lines: [
      { description: 'R-410A refrigerant 25lb cylinder', quantity: 2, unit_cost: 189.00, extended_cost: 378.00 },
      { description: 'R-22 refrigerant 30lb cylinder',   quantity: 1, unit_cost:  78.00, extended_cost:  78.00 },
    ],
  },
]

async function main() {
  // Upsert company
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

  // Fetch existing bills for this company
  const invoiceNumbers = BILL_SEEDS.map(b => b.invoice_number)
  const { data: existingBills, error: fetchError } = await supabase
    .from('bills')
    .select('bill_id, invoice_number, company_id')
    .eq('company_id', companyId)
    .in('invoice_number', invoiceNumbers)

  if (fetchError) {
    console.error('Failed to fetch existing bills:', fetchError)
    process.exit(1)
  }

  // Insert any missing bills
  const existingNumbers = new Set((existingBills ?? []).map((b: { invoice_number: string }) => b.invoice_number))
  const newBills = BILL_SEEDS.filter(b => !existingNumbers.has(b.invoice_number)).map(({ lines: _, ...bill }) => ({
    ...bill,
    company_id: companyId,
  }))

  let insertedBills: { bill_id: string; invoice_number: string }[] = []
  if (newBills.length > 0) {
    const { data, error } = await supabase.from('bills').insert(newBills).select('bill_id, invoice_number')
    if (error) { console.error('Bills insert failed:', error); process.exit(1) }
    insertedBills = data ?? []
    console.log(`Inserted ${insertedBills.length} new bills.`)
  } else {
    console.log('All bills already exist — skipping bill insert.')
  }

  // Build a map from invoice_number → bill_id across existing + newly inserted
  const billMap = new Map<string, string>()
  for (const b of [...(existingBills ?? []), ...insertedBills] as { bill_id: string; invoice_number: string }[]) {
    billMap.set(b.invoice_number, b.bill_id)
  }

  // Delete existing line items for all these bills so we can re-seed cleanly
  const allBillIds = [...billMap.values()]
  if (allBillIds.length > 0) {
    await supabase.from('bill_line_items').delete().in('bill_id', allBillIds)
  }

  // Insert line items
  const lineItems = BILL_SEEDS.flatMap(({ invoice_number, lines }) => {
    const billId = billMap.get(invoice_number)
    if (!billId) return []
    return lines.map((line, i) => ({
      bill_id: billId,
      company_id: companyId,
      sort_order: i,
      ...line,
    }))
  })

  const { error: lineError } = await supabase.from('bill_line_items').insert(lineItems)
  if (lineError) { console.error('Line items insert failed:', lineError); process.exit(1) }

  console.log(`Inserted ${lineItems.length} line items across ${allBillIds.length} bills.`)
}

main()
