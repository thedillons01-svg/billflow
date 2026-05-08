import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })

import { createClient } from '@supabase/supabase-js'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type LineItem = {
  description: string
  quantity: number
  unit_cost: number
  extended_cost: number
}

type Bill = {
  bill_id: string
  company_id: string
  vendor_name_raw: string
  invoice_number: string
  invoice_date: string
  total: number
  bill_line_items: LineItem[]
}

async function generateInvoicePdf(bill: Bill): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const page = doc.addPage([612, 792])
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)

  const { height } = page.getSize()
  let y = height - 60

  const draw = (text: string | null | undefined, x: number, size = 11, useBold = false) => {
    if (!text) return
    page.drawText(text, { x, y, size, font: useBold ? bold : font, color: rgb(0.1, 0.1, 0.1) })
  }

  // Header
  draw('INVOICE', 72, 22, true)
  y -= 8
  page.drawLine({ start: { x: 72, y }, end: { x: 540, y }, thickness: 1, color: rgb(0.7, 0.7, 0.7) })
  y -= 24

  // Vendor info
  draw(bill.vendor_name_raw, 72, 13, true)
  y -= 18
  draw(`Invoice #: ${bill.invoice_number ?? ''}`, 72)
  y -= 16
  draw(`Date: ${bill.invoice_date ?? ''}`, 72)
  y -= 32

  // Line items header
  page.drawLine({ start: { x: 72, y: y + 4 }, end: { x: 540, y: y + 4 }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) })
  draw('Description', 72, 10, true)
  draw('Qty', 370, 10, true)
  draw('Unit Cost', 410, 10, true)
  draw('Extended', 490, 10, true)
  y -= 6
  page.drawLine({ start: { x: 72, y }, end: { x: 540, y }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) })
  y -= 18

  // Line items
  for (const line of bill.bill_line_items) {
    const raw = line.description ?? ''
    const desc = raw.length > 44 ? raw.slice(0, 44) + '...' : raw
    draw(desc, 72, 10)
    draw(String(line.quantity), 378, 10)
    draw(`$${(line.unit_cost ?? 0).toFixed(2)}`, 410, 10)
    draw(`$${(line.extended_cost ?? 0).toFixed(2)}`, 490, 10)
    y -= 16
  }

  // Total
  y -= 8
  page.drawLine({ start: { x: 72, y }, end: { x: 540, y }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) })
  y -= 18
  draw('TOTAL', 410, 12, true)
  draw(`$${(bill.total ?? 0).toFixed(2)}`, 490, 12, true)

  return doc.save()
}

async function main() {
  const { data: bills, error } = await supabase
    .from('bills')
    .select(`
      bill_id, company_id, vendor_name_raw, invoice_number, invoice_date, total,
      bill_line_items ( description, quantity, unit_cost, extended_cost, sort_order )
    `)

  if (error || !bills) {
    console.error('Failed to fetch bills:', error)
    process.exit(1)
  }

  for (const bill of bills as Bill[]) {
    const lineItems = [...bill.bill_line_items].sort((a: { sort_order?: number }, b: { sort_order?: number }) =>
      (a.sort_order ?? 0) - (b.sort_order ?? 0)
    )
    const pdfBytes = await generateInvoicePdf({ ...bill, bill_line_items: lineItems })
    const storagePath = `${bill.company_id}/${bill.bill_id}.pdf`

    const { error: uploadErr } = await supabase.storage
      .from('bill-pdfs')
      .upload(storagePath, pdfBytes, { contentType: 'application/pdf', upsert: true })

    if (uploadErr) {
      console.error(`Upload failed for ${bill.invoice_number}:`, uploadErr.message)
      continue
    }

    const { error: updateErr } = await supabase
      .from('bills')
      .update({ pdf_url: storagePath })
      .eq('bill_id', bill.bill_id)

    if (updateErr) {
      console.error(`Update failed for ${bill.invoice_number}:`, updateErr.message)
      continue
    }

    console.log(`✓ ${bill.invoice_number} — ${bill.vendor_name_raw}`)
  }

  console.log('\nDone.')
}

main()
