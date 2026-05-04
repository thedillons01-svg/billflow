// One-off test: find first draft bill, run OCR, print results
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })

import { createClient } from '@supabase/supabase-js'
import { processBill } from '../src/lib/ocr/process'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  // Find first draft bill
  const { data: bill, error } = await supabase
    .from('bills')
    .select('bill_id, pdf_url, status')
    .eq('status', 'draft')
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  if (error || !bill) {
    console.error('No draft bills found:', error?.message)
    process.exit(1)
  }

  console.log(`Found draft bill: ${bill.bill_id}`)
  console.log(`PDF path:        ${bill.pdf_url}\n`)
  console.log('Running OCR pipeline...\n')

  await processBill(bill.bill_id)

  // Fetch updated bill
  const { data: updated } = await supabase
    .from('bills')
    .select('*')
    .eq('bill_id', bill.bill_id)
    .single()

  // Fetch line items
  const { data: lineItems } = await supabase
    .from('bill_line_items')
    .select('*')
    .eq('bill_id', bill.bill_id)
    .order('sort_order')

  console.log('=== EXTRACTED BILL ===')
  console.log(JSON.stringify({
    bill_id:             updated?.bill_id,
    status:              updated?.status,
    ocr_tier:            updated?.ocr_tier,
    ocr_confidence:      updated?.ocr_confidence,
    vendor_name_raw:     updated?.vendor_name_raw,
    invoice_number:      updated?.invoice_number,
    invoice_date:        updated?.invoice_date,
    due_date:            updated?.due_date,
    vendor_po_reference: updated?.vendor_po_reference,
    subtotal:            updated?.subtotal,
    tax_amount:          updated?.tax_amount,
    total:               updated?.total,
  }, null, 2))

  console.log(`\n=== LINE ITEMS (${lineItems?.length ?? 0}) ===`)
  console.log(JSON.stringify(lineItems?.map(li => ({
    description:   li.description,
    quantity:      li.quantity,
    unit_cost:     li.unit_cost,
    extended_cost: li.extended_cost,
  })), null, 2))
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
