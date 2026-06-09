/**
 * TEST BATCH 2 — Comprehensive condition coverage
 * Each PDF tests one specific system behavior.
 * Invoice numbers are encoded so you can tell at a glance what condition is being tested.
 *
 * Usage: node scripts/generate-test-batch2.mjs
 * Output: scripts/test-pdfs-batch2/
 *
 * EMAIL ROUTING:
 *   Invoices (01–12) → [prefix]-bills@purchasomatic.com
 *   POs (13–18)      → [prefix]-pos@purchasomatic.com
 *
 * CONDITIONS COVERED:
 *   01  New vendor never in QB or Purchasomatic
 *   02  Credit note / credit memo (negative amounts)
 *   03  Line items sum ≠ header total (mismatch — should block auto-publish)
 *   04  Tax as a separate line item (not a footer summary)
 *   05  Duplicate invoice — same vendor + invoice number as batch-1 invoice 01
 *   06  No invoice number field
 *   07  No invoice date field
 *   08  PO reference that should match an existing QB job (job match HIT)
 *   09  PO reference that won't match any QB job (job match MISS → pending_job_match)
 *   10  Customer name only on invoice, no sub-job
 *   11  Large invoice — 12 line items across multiple GL categories
 *   12  Long descriptions — 80+ character line item descriptions
 *   13  PO — new vendor never seen before
 *   14  PO — vendor includes unit prices and extended totals in confirmation
 *   15  PO — no customer PO reference / no job info
 *   16  PO — job reference that should match existing QB job
 *   17  PO — 10+ line items (many lines)
 *   18  PO — shop stock order, explicitly no job
 */

import PDFDocument from 'pdfkit'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR = path.join(__dirname, 'test-pdfs-batch2')
fs.mkdirSync(OUT_DIR, { recursive: true })

// ── Helpers ────────────────────────────────────────────────────────────────

function save(doc, filename) {
  return new Promise((resolve, reject) => {
    const out = path.join(OUT_DIR, filename)
    const stream = fs.createWriteStream(out)
    doc.pipe(stream)
    doc.end()
    stream.on('finish', () => { console.log(`✓  ${filename}`); resolve() })
    stream.on('error', reject)
  })
}

function vendorHeader(doc, name, address, phone) {
  doc.fontSize(18).font('Helvetica-Bold').fillColor('#000000').text(name, 50, 50)
  doc.fontSize(9).font('Helvetica').fillColor('#555555')
  doc.text(address, 50, 72)
  if (phone) doc.text(phone, 50, 84)
  doc.fillColor('#000000')
}

function divider(doc, y) {
  doc.moveTo(50, y).lineTo(545, y).strokeColor('#cccccc').lineWidth(0.5).stroke()
}

function lv(doc, x, y, label, value) {
  doc.fontSize(8).font('Helvetica-Bold').fillColor('#555555').text(label, x, y)
  doc.fontSize(10).font('Helvetica').fillColor('#000000').text(value, x, y + 12)
}

/** Standard line items table. Returns { subtotal, tax, total, endY } */
function lineTable(doc, startY, items, showTax = true) {
  const C = { desc: 50, qty: 310, unit: 370, ext: 460 }
  doc.fontSize(8).font('Helvetica-Bold').fillColor('#444444')
  doc.text('DESCRIPTION', C.desc, startY)
  doc.text('QTY',         C.qty,  startY, { width: 55, align: 'right' })
  doc.text('UNIT PRICE',  C.unit, startY, { width: 80, align: 'right' })
  doc.text('AMOUNT',      C.ext,  startY, { width: 85, align: 'right' })
  divider(doc, startY + 14)

  let y = startY + 22
  let subtotal = 0
  doc.font('Helvetica').fillColor('#000000').fontSize(9)
  for (const item of items) {
    const ext = +(item.qty * item.unit).toFixed(2)
    subtotal += ext
    doc.text(item.desc,                     C.desc, y, { width: 250 })
    doc.text(String(item.qty),              C.qty,  y, { width: 55,  align: 'right' })
    doc.text(`$${item.unit.toFixed(2)}`,    C.unit, y, { width: 80,  align: 'right' })
    doc.text(`$${ext.toFixed(2)}`,          C.ext,  y, { width: 85,  align: 'right' })
    y += 18
  }
  divider(doc, y + 4)

  const tax   = showTax ? +(subtotal * 0.085).toFixed(2) : 0
  const total = +(subtotal + tax).toFixed(2)
  y += 14

  doc.fontSize(9).fillColor('#555555')
  doc.text('Subtotal', C.unit, y, { width: 80, align: 'right' })
  doc.fillColor('#000000').text(`$${subtotal.toFixed(2)}`, C.ext, y, { width: 85, align: 'right' })

  if (showTax) {
    y += 16
    doc.fillColor('#555555').text('Tax (8.5%)', C.unit, y, { width: 80, align: 'right' })
    doc.fillColor('#000000').text(`$${tax.toFixed(2)}`, C.ext, y, { width: 85, align: 'right' })
  }

  y += 16
  doc.fontSize(10).font('Helvetica-Bold').fillColor('#000000')
  doc.text('Invoice Total', C.unit, y, { width: 80, align: 'right' })
  doc.text(`$${total.toFixed(2)}`, C.ext, y, { width: 85, align: 'right' })

  return { subtotal, tax, total, endY: y + 30 }
}

/** Line table for credit notes — amounts shown as negative */
function creditTable(doc, startY, items) {
  const C = { desc: 50, qty: 310, unit: 370, ext: 460 }
  doc.fontSize(8).font('Helvetica-Bold').fillColor('#444444')
  doc.text('DESCRIPTION', C.desc, startY)
  doc.text('QTY',         C.qty,  startY, { width: 55, align: 'right' })
  doc.text('UNIT PRICE',  C.unit, startY, { width: 80, align: 'right' })
  doc.text('AMOUNT',      C.ext,  startY, { width: 85, align: 'right' })
  divider(doc, startY + 14)

  let y = startY + 22
  let total = 0
  doc.font('Helvetica').fillColor('#000000').fontSize(9)
  for (const item of items) {
    const ext = +(item.qty * item.unit).toFixed(2)
    total += ext
    doc.text(item.desc,                        C.desc, y, { width: 250 })
    doc.text(String(item.qty),                 C.qty,  y, { width: 55,  align: 'right' })
    doc.text(`$${item.unit.toFixed(2)}`,       C.unit, y, { width: 80,  align: 'right' })
    doc.fillColor('#CC0000').text(`($${ext.toFixed(2)})`, C.ext, y, { width: 85, align: 'right' })
    doc.fillColor('#000000')
    y += 18
  }
  divider(doc, y + 4)
  y += 14
  doc.fontSize(10).font('Helvetica-Bold').fillColor('#CC0000')
  doc.text('Credit Total', C.unit, y, { width: 80, align: 'right' })
  doc.text(`($${total.toFixed(2)})`, C.ext, y, { width: 85, align: 'right' })
  doc.fillColor('#000000')
  return { total, endY: y + 30 }
}

// ══════════════════════════════════════════════════════════════════════════════
// INVOICES
// ══════════════════════════════════════════════════════════════════════════════

// ── 01: New vendor — never in QB or Purchasomatic ────────────────────────────
// Expected: vendor creation prompt, no auto-publish eligible

async function inv01NewVendor() {
  const doc = new PDFDocument({ size: 'LETTER', margin: 0 })
  vendorHeader(doc, 'NovaTech HVAC Supply Co.', '4400 Commerce Park Dr, Salem, OR 97304', '(503) 588-2200  |  novatechhvac.com')

  doc.fontSize(20).font('Helvetica-Bold').text('INVOICE', 390, 50)
  lv(doc, 390, 80,  'Invoice #',    'INV-TEST-NEWVEND-001')
  lv(doc, 390, 108, 'Invoice Date', '06/10/2026')
  lv(doc, 390, 136, 'Due Date',     '07/10/2026')
  lv(doc, 390, 164, 'Terms',        'Net 30')
  divider(doc, 190)
  lv(doc, 50, 205, 'Sold To', 'Pacific Northwest HVAC Services\n4821 NE Broadway, Portland OR 97213')
  divider(doc, 242)

  lineTable(doc, 258, [
    { desc: 'Mini-Split System 18000 BTU Heat Pump 230V', qty: 1, unit: 1245.00 },
    { desc: 'Line Set 1/4 x 1/2 x 25ft Pre-Charged',     qty: 2, unit: 89.50   },
    { desc: 'Indoor Wall Mount Air Handler Unit',         qty: 1, unit: 312.00  },
    { desc: 'Mounting Bracket Kit Heavy Duty',            qty: 1, unit: 34.75   },
    { desc: 'Condensate Drain Kit with Pump',             qty: 1, unit: 67.00   },
  ])

  doc.fontSize(8).fillColor('#555555').text('New customer inquiry? Call (503) 588-2200 or visit novatechhvac.com', 50, 720)
  await save(doc, '01-INV-TEST-NEWVEND-001.pdf')
}

// ── 02: Credit note / credit memo ────────────────────────────────────────────
// Expected: bill_type = credit_note, negative total, pushes as VendorCredit in QBO

async function inv02CreditNote() {
  const doc = new PDFDocument({ size: 'LETTER', margin: 0 })
  vendorHeader(doc, 'Gensco, Inc.', '3535 Rainier Ave S, Seattle, WA 98144', '(206) 725-6000  |  www.gensco.com')

  doc.fontSize(20).font('Helvetica-Bold').fillColor('#CC0000').text('CREDIT MEMO', 350, 50)
  doc.fillColor('#000000')
  lv(doc, 350, 82,  'Credit Memo #',    'INV-TEST-CREDITNOTE-001')
  lv(doc, 350, 110, 'Date',             '06/10/2026')
  lv(doc, 350, 138, 'Original Inv #',   'GEN-2026-88341')
  lv(doc, 350, 166, 'Reason',           'Returned — wrong part')
  divider(doc, 192)
  lv(doc, 50, 207, 'Bill To', 'Pacific Northwest HVAC Services\n4821 NE Broadway, Portland OR 97213')
  lv(doc, 300, 207, 'Customer PO #', 'PO-2026-1052')
  lv(doc, 300, 235, 'Job', '2026-Riverside HVAC Upgrade')
  divider(doc, 262)

  doc.fontSize(11).font('Helvetica-Bold').fillColor('#CC0000').text('CREDIT FOR RETURNED ITEMS', 50, 275)
  doc.fillColor('#000000')

  creditTable(doc, 295, [
    { desc: 'Carrier 24ACC636A003 3-Ton Split AC Condenser — RETURNED', qty: 1, unit: 1842.00 },
    { desc: 'Copper Line Set 3/8 x 7/8 x 25ft — RETURNED',             qty: 2, unit: 94.00   },
  ])

  doc.fontSize(8).fillColor('#555555').text('Credit will be applied to your account within 5 business days.', 50, 720)
  await save(doc, '02-INV-TEST-CREDITNOTE-001.pdf')
}

// ── 03: Line items don't add up to header total ───────────────────────────────
// Expected: auto-publish blocked, line_items_total ≠ total flagged in UI

async function inv03LineMismatch() {
  const doc = new PDFDocument({ size: 'LETTER', margin: 0 })
  vendorHeader(doc, 'Johnstone Supply', '8901 SE Powell Blvd, Portland, OR 97266', '(503) 775-3141')

  doc.fontSize(20).font('Helvetica-Bold').text('INVOICE', 390, 50)
  lv(doc, 390, 80,  'Invoice No.',  'INV-TEST-LINEMISMATCH-001')
  lv(doc, 390, 108, 'Date',         '06/10/2026')
  lv(doc, 390, 136, 'Your PO #',    'PO-2026-1089')
  divider(doc, 162)
  lv(doc, 50, 177, 'Sold To', 'Pacific Northwest HVAC Services\n4821 NE Broadway, Portland OR 97213')
  divider(doc, 220)

  // Line items — real sum = $617.95 + tax. Header total is intentionally wrong.
  const C = { desc: 50, qty: 310, unit: 370, ext: 460 }
  const items = [
    { desc: 'Contactor 24V 40A 2-Pole',                    qty: 6,  unit: 18.45  },
    { desc: 'Hard Start Kit 3-Wire 88-106 MFD',            qty: 4,  unit: 32.00  },
    { desc: 'Capacitor Dual Run 45+5 MFD 440V Round',      qty: 10, unit: 14.75  },
    { desc: 'Blower Motor 1/3 HP 4-Speed 208-230V',        qty: 3,  unit: 124.50 },
  ]

  doc.fontSize(8).font('Helvetica-Bold').fillColor('#444444')
  doc.text('DESCRIPTION', C.desc, 236); doc.text('QTY', C.qty, 236, { width: 55, align: 'right' })
  doc.text('UNIT PRICE', C.unit, 236, { width: 80, align: 'right' }); doc.text('AMOUNT', C.ext, 236, { width: 85, align: 'right' })
  divider(doc, 250)

  let y = 258
  let lineSum = 0
  doc.font('Helvetica').fillColor('#000000').fontSize(9)
  for (const item of items) {
    const ext = +(item.qty * item.unit).toFixed(2)
    lineSum += ext
    doc.text(item.desc, C.desc, y, { width: 250 })
    doc.text(String(item.qty), C.qty, y, { width: 55, align: 'right' })
    doc.text(`$${item.unit.toFixed(2)}`, C.unit, y, { width: 80, align: 'right' })
    doc.text(`$${ext.toFixed(2)}`, C.ext, y, { width: 85, align: 'right' })
    y += 18
  }
  divider(doc, y + 4)

  // Tax calculated correctly
  const tax = +(lineSum * 0.085).toFixed(2)
  // *** HEADER TOTAL IS WRONG ON PURPOSE — off by $50 ***
  const wrongTotal = +(lineSum + tax + 50).toFixed(2)

  y += 14
  doc.fontSize(9).fillColor('#555555')
  doc.text('Subtotal', C.unit, y, { width: 80, align: 'right' })
  doc.fillColor('#000000').text(`$${lineSum.toFixed(2)}`, C.ext, y, { width: 85, align: 'right' })
  y += 16
  doc.fillColor('#555555').text('Tax (8.5%)', C.unit, y, { width: 80, align: 'right' })
  doc.fillColor('#000000').text(`$${tax.toFixed(2)}`, C.ext, y, { width: 85, align: 'right' })
  y += 16
  doc.fontSize(10).font('Helvetica-Bold')
  doc.text('Invoice Total', C.unit, y, { width: 80, align: 'right' })
  // Deliberately wrong total printed on the invoice
  doc.text(`$${wrongTotal.toFixed(2)}`, C.ext, y, { width: 85, align: 'right' })

  doc.fontSize(7).fillColor('#888888').text(`(Line items sum: $${(lineSum + tax).toFixed(2)} — header shows $${wrongTotal.toFixed(2)} — intentional mismatch for test)`, 50, y + 30)
  await save(doc, '03-INV-TEST-LINEMISMATCH-001.pdf')
}

// ── 04: Tax as a separate line item ──────────────────────────────────────────
// Expected: tax line extracted as regular line item, included in line total

async function inv04TaxAsLine() {
  const doc = new PDFDocument({ size: 'LETTER', margin: 0 })
  vendorHeader(doc, 'Ferguson Enterprises, LLC', '1010 Industrial Way, Beaverton, OR 97006', '(503) 641-8900  |  ferguson.com')

  doc.fontSize(20).font('Helvetica-Bold').text('INVOICE', 390, 50)
  lv(doc, 390, 80,  'Invoice #',    'INV-TEST-TAXLINE-001')
  lv(doc, 390, 108, 'Invoice Date', '06/10/2026')
  lv(doc, 390, 136, 'Reference',    'PO-2026-0887')
  divider(doc, 162)
  lv(doc, 50, 177, 'Bill To',  'Cascade Mechanical LLC\n771 SE 6th Ave, Hillsboro OR 97123')
  lv(doc, 50, 225, 'Project',  'Brownsville Commerce Center — Phase 2')
  divider(doc, 252)

  // Items with no tax in table footer — tax is its own line item
  const C = { desc: 50, qty: 310, unit: 370, ext: 460 }
  const materials = [
    { desc: 'Copper Pipe Type L 1" x 10ft',                   qty: 20,  unit: 14.25,  isTax: false },
    { desc: 'Copper Elbow 1" 90° Sweat',                      qty: 40,  unit: 2.10,   isTax: false },
    { desc: 'Ball Valve 1" Full Port Brass',                   qty: 10,  unit: 28.50,  isTax: false },
    { desc: 'Pipe Insulation 1" x 3ft Armaflex',              qty: 30,  unit: 6.75,   isTax: false },
    { desc: 'Flux Paste 8oz Jar',                             qty: 5,   unit: 7.20,   isTax: false },
    { desc: 'Solder 50/50 1 lb Roll',                         qty: 5,   unit: 12.00,  isTax: false },
  ]
  const matSum = materials.reduce((s, i) => s + i.qty * i.unit, 0)
  const taxAmt = +(matSum * 0.085).toFixed(2)
  const taxLine = { desc: 'Oregon State Sales Tax (8.5%)', qty: 1, unit: taxAmt, isTax: true }
  const allItems = [...materials, taxLine]

  doc.fontSize(8).font('Helvetica-Bold').fillColor('#444444')
  doc.text('DESCRIPTION', C.desc, 268); doc.text('QTY', C.qty, 268, { width: 55, align: 'right' })
  doc.text('UNIT PRICE', C.unit, 268, { width: 80, align: 'right' }); doc.text('AMOUNT', C.ext, 268, { width: 85, align: 'right' })
  divider(doc, 282)

  let y = 290
  doc.font('Helvetica').fillColor('#000000').fontSize(9)
  for (const item of allItems) {
    if (item.isTax) {
      doc.fillColor('#555555').font('Helvetica-Oblique')
    } else {
      doc.fillColor('#000000').font('Helvetica')
    }
    const ext = +(item.qty * item.unit).toFixed(2)
    doc.text(item.desc, C.desc, y, { width: 250 })
    doc.text(String(item.qty), C.qty, y, { width: 55, align: 'right' })
    doc.text(`$${item.unit.toFixed(2)}`, C.unit, y, { width: 80, align: 'right' })
    doc.text(`$${ext.toFixed(2)}`, C.ext, y, { width: 85, align: 'right' })
    y += 18
  }
  divider(doc, y + 4)
  const grandTotal = +(matSum + taxAmt).toFixed(2)
  y += 14
  doc.fontSize(10).font('Helvetica-Bold').fillColor('#000000')
  doc.text('Invoice Total', C.unit, y, { width: 80, align: 'right' })
  doc.text(`$${grandTotal.toFixed(2)}`, C.ext, y, { width: 85, align: 'right' })

  doc.fontSize(7).fillColor('#888888').text('Tax line is an explicit line item on this invoice — no separate tax footer.', 50, y + 30)
  await save(doc, '04-INV-TEST-TAXLINE-001.pdf')
}

// ── 05: Duplicate — same vendor + invoice number as batch-1 invoice 01 ────────
// Expected: duplicate detection fires, bill held, no charge

async function inv05Duplicate() {
  const doc = new PDFDocument({ size: 'LETTER', margin: 0 })
  vendorHeader(doc, 'Gensco, Inc.', '3535 Rainier Ave S, Seattle, WA 98144', '(206) 725-6000  |  www.gensco.com')

  doc.fontSize(22).font('Helvetica-Bold').fillColor('#1a3d2b').text('INVOICE', 390, 50)
  doc.fillColor('#000000')
  // EXACT SAME INVOICE NUMBER as 01-gensco-invoice-with-job.pdf
  lv(doc, 390, 80,  'Invoice #',    'GEN-2026-88341')
  lv(doc, 390, 108, 'Invoice Date', '06/03/2026')
  lv(doc, 390, 136, 'Due Date',     '07/03/2026')
  lv(doc, 390, 164, 'Terms',        'Net 30')
  divider(doc, 190)
  lv(doc, 50,  205, 'Bill To',       'Pacific Northwest HVAC Services\n4821 NE Broadway, Portland OR 97213')
  lv(doc, 300, 205, 'Customer PO #', 'PO-2026-1052')
  lv(doc, 300, 233, 'Job',           '2026-Riverside HVAC Upgrade')
  divider(doc, 260)

  lineTable(doc, 276, [
    { desc: 'Carrier 24ACC636A003 3-Ton Split AC Condenser', qty: 2, unit: 1842.00 },
    { desc: 'Carrier FB4CNF036L00 Air Handler 3-Ton',        qty: 2, unit: 623.50  },
    { desc: 'Refrigerant R-410A 25 lb Cylinder',             qty: 4, unit: 87.25   },
  ])

  doc.fontSize(7).fillColor('#888888').text('TEST: This is an intentional duplicate of batch-1 invoice 01 (same vendor + invoice number GEN-2026-88341). Expect duplicate detection to fire.', 50, 680)
  await save(doc, '05-INV-TEST-DUPE-OF-BATCH1-01.pdf')
}

// ── 06: No invoice number ─────────────────────────────────────────────────────
// Expected: invoice_number = null, system processes without it

async function inv06NoInvoiceNumber() {
  const doc = new PDFDocument({ size: 'LETTER', margin: 0 })
  vendorHeader(doc, 'Willamette Valley Refrigeration Supply', '2210 Commercial St SE, Salem, OR 97302', '(503) 399-7744')

  doc.fontSize(20).font('Helvetica-Bold').text('INVOICE', 390, 50)
  // No invoice number — deliberately omitted
  lv(doc, 390, 80,  'Date',      '06/10/2026')
  lv(doc, 390, 108, 'Due Date',  '07/10/2026')
  lv(doc, 390, 136, 'Your PO #', 'INV-TEST-NOINVNUM')
  divider(doc, 162)
  lv(doc, 50, 177, 'Sold To', 'Pacific Northwest HVAC Services\n4821 NE Broadway, Portland OR 97213')
  divider(doc, 220)

  lineTable(doc, 236, [
    { desc: 'Refrigerant R-22 30 lb Cylinder (Reclaimed)',  qty: 2,  unit: 145.00 },
    { desc: 'Refrigerant R-410A 25 lb Cylinder',            qty: 4,  unit: 87.25  },
    { desc: 'Vacuum Pump 6 CFM Two-Stage',                  qty: 1,  unit: 248.00 },
    { desc: 'Manifold Gauge Set 4-Valve R-410A',            qty: 1,  unit: 89.50  },
  ])

  doc.fontSize(7).fillColor('#888888').text('TEST: No invoice number field on this invoice. System should process with invoice_number = null.', 50, 680)
  await save(doc, '06-INV-TEST-NOINVNUM.pdf')
}

// ── 07: No invoice date ────────────────────────────────────────────────────────
// Expected: invoice_date = null, system processes without it

async function inv07NoDate() {
  const doc = new PDFDocument({ size: 'LETTER', margin: 0 })
  vendorHeader(doc, 'Cascade Controls & Automation', '500 N Columbia River Hwy, Clatskanie, OR 97016', '(503) 728-4500')

  doc.fontSize(20).font('Helvetica-Bold').text('INVOICE', 390, 50)
  lv(doc, 390, 80,  'Invoice #',  'INV-TEST-NODATE-001')
  // No date — deliberately omitted
  lv(doc, 390, 108, 'Your PO #',  'PO-2026-1122')
  lv(doc, 390, 136, 'Terms',      'Net 30')
  divider(doc, 162)
  lv(doc, 50, 177, 'Bill To',   'Pacific Northwest HVAC Services\n4821 NE Broadway, Portland OR 97213')
  lv(doc, 300, 177, 'Job',       'Clatskanie Industrial HVAC Controls Upgrade')
  lv(doc, 300, 205, 'Customer',  'Port of Clatskanie')
  divider(doc, 228)

  lineTable(doc, 244, [
    { desc: 'Honeywell VisionPRO 8000 7-Day Programmable Thermostat', qty: 4,  unit: 189.00 },
    { desc: 'Johnson Controls Variable Frequency Drive 5HP 460V',     qty: 2,  unit: 1150.00 },
    { desc: 'Pressure Transducer 0-500 PSI 4-20mA',                   qty: 6,  unit: 78.50  },
    { desc: 'Temperature Sensor NTC 10K 3-Wire 1/4" NPT',             qty: 8,  unit: 32.00  },
  ])

  doc.fontSize(7).fillColor('#888888').text('TEST: No invoice date field. System should process with invoice_date = null.', 50, 680)
  await save(doc, '07-INV-TEST-NODATE-001.pdf')
}

// ── 08: PO reference that should match an existing QB job (HIT) ──────────────
// Expected: job matched, bill auto-tagged, status = ready or auto-published
// NOTE: Set up a QB job whose name/number includes "2026-Riverside HVAC Upgrade"
//       (same job referenced in batch-1 invoice 01) before testing this.

async function inv08JobMatchHit() {
  const doc = new PDFDocument({ size: 'LETTER', margin: 0 })
  vendorHeader(doc, 'Gensco, Inc.', '3535 Rainier Ave S, Seattle, WA 98144', '(206) 725-6000  |  www.gensco.com')

  doc.fontSize(22).font('Helvetica-Bold').fillColor('#1a3d2b').text('INVOICE', 390, 50)
  doc.fillColor('#000000')
  lv(doc, 390, 80,  'Invoice #',    'INV-TEST-JOBMATCH-HIT-001')
  lv(doc, 390, 108, 'Invoice Date', '06/10/2026')
  lv(doc, 390, 136, 'Due Date',     '07/10/2026')
  lv(doc, 390, 164, 'Customer PO #', 'PO-2026-1052')
  divider(doc, 190)
  lv(doc, 50,  205, 'Bill To',   'Pacific Northwest HVAC Services\n4821 NE Broadway, Portland OR 97213')
  // Job name matches what's in QB — same as batch-1 invoice 01
  lv(doc, 300, 205, 'Job',       '2026-Riverside HVAC Upgrade')
  lv(doc, 300, 233, 'Customer',  'Metro Property Group')
  divider(doc, 260)

  lineTable(doc, 276, [
    { desc: 'Refrigerant R-410A 25 lb Cylinder',         qty: 6,  unit: 87.25  },
    { desc: 'Filter Drier Bi-Flow 1/2" Flare',           qty: 6,  unit: 24.50  },
    { desc: 'Sight Glass w/ Moisture Indicator 1/2"',    qty: 6,  unit: 19.75  },
    { desc: 'Service Valve 3/8" x 1/2" Ball Valve',      qty: 6,  unit: 28.00  },
  ])

  doc.fontSize(7).fillColor('#888888').text('TEST: Job reference "2026-Riverside HVAC Upgrade" should match an existing QB job. Expect auto-tag.', 50, 680)
  await save(doc, '08-INV-TEST-JOBMATCH-HIT-001.pdf')
}

// ── 09: PO reference that won't match any QB job (MISS → pending_job_match) ──
// Expected: status = pending_job_match, retry every 2h during business hours

async function inv09JobMatchMiss() {
  const doc = new PDFDocument({ size: 'LETTER', margin: 0 })
  vendorHeader(doc, 'Johnstone Supply', '8901 SE Powell Blvd, Portland, OR 97266', '(503) 775-3141')

  doc.fontSize(20).font('Helvetica-Bold').text('INVOICE', 390, 50)
  lv(doc, 390, 80,  'Invoice No.',  'INV-TEST-JOBMATCH-MISS-001')
  lv(doc, 390, 108, 'Date',         '06/10/2026')
  // Reference that will NOT match any QB job
  lv(doc, 390, 136, 'Your PO #',    'PO-2026-XYZNOTREAL')
  divider(doc, 162)
  lv(doc, 50, 177, 'Sold To', 'Pacific Northwest HVAC Services\n4821 NE Broadway, Portland OR 97213')
  lv(doc, 300, 177, 'Job', 'XYZNOTREAL — Fake Job Reference')
  divider(doc, 220)

  lineTable(doc, 236, [
    { desc: 'Contactor 24V 40A 2-Pole',               qty: 10, unit: 18.45 },
    { desc: 'Capacitor Dual Run 45+5 MFD 440V Round', qty: 10, unit: 14.75 },
    { desc: 'Hard Start Kit 3-Wire 88-106 MFD',       qty: 5,  unit: 32.00 },
  ])

  doc.fontSize(7).fillColor('#888888').text('TEST: Job reference "PO-2026-XYZNOTREAL" should NOT match any QB job. Expect status = pending_job_match.', 50, 680)
  await save(doc, '09-INV-TEST-JOBMATCH-MISS-001.pdf')
}

// ── 10: Customer name only — no sub-job ───────────────────────────────────────
// Expected: matched to top-level QB customer, no sub-job assigned
// (Behavior depends on job_tagging_level setting)

async function inv10CustomerOnly() {
  const doc = new PDFDocument({ size: 'LETTER', margin: 0 })
  vendorHeader(doc, 'Ferguson Enterprises, LLC', '1010 Industrial Way, Beaverton, OR 97006', '(503) 641-8900  |  ferguson.com')

  doc.fontSize(20).font('Helvetica-Bold').text('INVOICE', 390, 50)
  lv(doc, 390, 80,  'Invoice #',    'INV-TEST-CUSTONLY-001')
  lv(doc, 390, 108, 'Invoice Date', '06/10/2026')
  lv(doc, 390, 136, 'Reference',    'PO-2026-1201')
  divider(doc, 162)
  lv(doc, 50, 177, 'Bill To', 'Pacific Northwest HVAC Services\n4821 NE Broadway, Portland OR 97213')
  // Customer name only — no sub-job or job number
  lv(doc, 50, 225, 'Customer', 'Metro Property Group')
  // No "Job" field at all
  divider(doc, 252)

  lineTable(doc, 268, [
    { desc: 'Copper Pipe 3/4" Type L x 10ft', qty: 30, unit: 10.80 },
    { desc: 'Copper Elbow 3/4" 90° Sweat',    qty: 60, unit: 1.45  },
    { desc: 'Ball Valve 3/4" Full Port',       qty: 12, unit: 22.50 },
    { desc: 'Pipe Insulation 3/4" Armaflex',   qty: 30, unit: 5.25  },
    { desc: 'Flux Paste 8oz',                  qty: 4,  unit: 7.20  },
  ])

  doc.fontSize(7).fillColor('#888888').text('TEST: Only customer name on invoice, no sub-job. Match depends on job_tagging_level setting.', 50, 680)
  await save(doc, '10-INV-TEST-CUSTONLY-001.pdf')
}

// ── 11: Large invoice — 12 line items across multiple GL categories ────────────
// Expected: all lines extracted, GL suggestions vary by description

async function inv11ManyLines() {
  const doc = new PDFDocument({ size: 'LETTER', margin: 0 })
  vendorHeader(doc, 'Gensco, Inc.', '3535 Rainier Ave S, Seattle, WA 98144', '(206) 725-6000  |  www.gensco.com')

  doc.fontSize(22).font('Helvetica-Bold').fillColor('#1a3d2b').text('INVOICE', 390, 50)
  doc.fillColor('#000000')
  lv(doc, 390, 80,  'Invoice #',    'INV-TEST-MANYLINES-001')
  lv(doc, 390, 108, 'Invoice Date', '06/10/2026')
  lv(doc, 390, 136, 'Due Date',     '07/10/2026')
  lv(doc, 390, 164, 'Customer PO #', 'PO-2026-1305')
  lv(doc, 390, 192, 'Job',           '2026-Eastside Commercial Retrofit')
  divider(doc, 218)
  lv(doc, 50, 233, 'Bill To', 'Pacific Northwest HVAC Services\n4821 NE Broadway, Portland OR 97213')
  lv(doc, 300, 233, 'Customer', 'Eastside Properties LLC')
  divider(doc, 270)

  lineTable(doc, 286, [
    { desc: 'Carrier 4-Ton Rooftop Unit 48TCED08A2A5',               qty: 1,  unit: 6840.00 },
    { desc: 'Economizer Module for 48TCE Series',                     qty: 1,  unit: 425.00  },
    { desc: 'Gas Heat Section 115 MBH Natural Gas',                   qty: 1,  unit: 680.00  },
    { desc: 'Curb Adapter Roof Curb 14" x 56"',                      qty: 1,  unit: 245.00  },
    { desc: 'Refrigerant R-410A 25 lb Cylinder',                      qty: 6,  unit: 87.25   },
    { desc: 'Duct Smoke Detector 120V Duct Mount',                    qty: 4,  unit: 138.00  },
    { desc: 'Thermostat Carrier ComfortLink II 7-Day Prog.',          qty: 2,  unit: 312.00  },
    { desc: 'Flexible Connector 12" x 12" x 6" Insulated',           qty: 4,  unit: 28.50   },
    { desc: 'Condensate Pan Kit SS with Drain',                       qty: 2,  unit: 64.00   },
    { desc: 'Vibration Isolator Pad 6" x 6" Neoprene',               qty: 8,  unit: 12.75   },
    { desc: 'Low Ambient Kit Wind Baffle 48TCE',                      qty: 1,  unit: 195.00  },
    { desc: 'Filter 20x25x4 MERV-11 (Case of 6)',                     qty: 4,  unit: 78.00   },
  ])

  await save(doc, '11-INV-TEST-MANYLINES-001.pdf')
}

// ── 12: Long descriptions ──────────────────────────────────────────────────────
// Expected: descriptions truncated or wrapped correctly, not garbled

async function inv12LongDescriptions() {
  const doc = new PDFDocument({ size: 'LETTER', margin: 0 })
  vendorHeader(doc, 'Wesco International — Portland Branch', '10260 SW Greenburg Rd Ste 100, Portland OR 97223', '(503) 245-1200')

  doc.fontSize(20).font('Helvetica-Bold').text('INVOICE', 390, 50)
  lv(doc, 390, 80,  'Invoice #',    'INV-TEST-LONGDESC-001')
  lv(doc, 390, 108, 'Invoice Date', '06/10/2026')
  lv(doc, 390, 136, 'Reference',    'PO-2026-1400')
  divider(doc, 162)
  lv(doc, 50, 177, 'Sold To', 'Pacific Northwest HVAC Services\n4821 NE Broadway, Portland OR 97213')
  lv(doc, 50, 225, 'Project', 'Hillsboro Semiconductor Campus — Building 3 HVAC Mechanical Room Upgrade')
  divider(doc, 252)

  const C = { desc: 50, qty: 310, unit: 370, ext: 460 }
  const items = [
    { desc: 'Emerson Copeland Scroll ZP61KCE-TFD-522 5-Ton 208-230/3/60 Compressor with Sound Blanket and Crankcase Heater', qty: 1, unit: 1845.00 },
    { desc: 'Sporlan Thermostatic Expansion Valve ORIT-12-CA w/External Equalizer Solder Connections 1/2" x 5/8" Capacity 12 Tons R-410A', qty: 2, unit: 128.50 },
    { desc: 'Alco Controls Filter Drier ADK-162S Bi-Directional Spun Steel 6 Cu In 1/2" SAE Flare R-410A', qty: 4, unit: 38.75 },
    { desc: 'Siemens MBKP2DEC-200A 200A Main Breaker Kit for P2 Panelboard with Distributed Ground Bus and Equipment Ground', qty: 1, unit: 445.00 },
    { desc: 'Hubbell HBL7787VBK 20A 125V Straight Blade Receptacle Duplex Hospital Grade Black with Self-Grounding Clip', qty: 12, unit: 18.90 },
  ]

  doc.fontSize(8).font('Helvetica-Bold').fillColor('#444444')
  doc.text('DESCRIPTION', C.desc, 268); doc.text('QTY', C.qty, 268, { width: 55, align: 'right' })
  doc.text('UNIT PRICE', C.unit, 268, { width: 80, align: 'right' }); doc.text('AMOUNT', C.ext, 268, { width: 85, align: 'right' })
  divider(doc, 282)

  let y = 290
  let total = 0
  doc.font('Helvetica').fillColor('#000000').fontSize(8)
  for (const item of items) {
    const ext = +(item.qty * item.unit).toFixed(2)
    total += ext
    const descHeight = doc.heightOfString(item.desc, { width: 248 })
    doc.text(item.desc, C.desc, y, { width: 248 })
    doc.text(String(item.qty), C.qty, y, { width: 55, align: 'right' })
    doc.text(`$${item.unit.toFixed(2)}`, C.unit, y, { width: 80, align: 'right' })
    doc.text(`$${ext.toFixed(2)}`, C.ext, y, { width: 85, align: 'right' })
    y += Math.max(descHeight + 6, 20)
  }
  divider(doc, y + 4)
  const tax = +(total * 0.085).toFixed(2)
  const grandTotal = +(total + tax).toFixed(2)
  y += 14
  doc.fontSize(9).fillColor('#555555').text('Subtotal', C.unit, y, { width: 80, align: 'right' })
  doc.fillColor('#000000').text(`$${total.toFixed(2)}`, C.ext, y, { width: 85, align: 'right' })
  y += 16
  doc.fillColor('#555555').text('Tax (8.5%)', C.unit, y, { width: 80, align: 'right' })
  doc.fillColor('#000000').text(`$${tax.toFixed(2)}`, C.ext, y, { width: 85, align: 'right' })
  y += 16
  doc.fontSize(10).font('Helvetica-Bold')
  doc.text('Invoice Total', C.unit, y, { width: 80, align: 'right' })
  doc.text(`$${grandTotal.toFixed(2)}`, C.ext, y, { width: 85, align: 'right' })

  doc.fontSize(7).fillColor('#888888').text('TEST: All descriptions are 80+ characters. Verify extraction is complete and not truncated.', 50, y + 30)
  await save(doc, '12-INV-TEST-LONGDESC-001.pdf')
}

// ══════════════════════════════════════════════════════════════════════════════
// PURCHASE ORDERS
// ══════════════════════════════════════════════════════════════════════════════

// ── 13: PO — new vendor never in system ──────────────────────────────────────
// Expected: vendor creation prompt, PO created in holding state

async function po13NewVendor() {
  const doc = new PDFDocument({ size: 'LETTER', margin: 0 })
  vendorHeader(doc, 'Mountain States Mechanical Supply', '1800 W 6th Ave, Denver, CO 80204', '(303) 893-4100  |  msmechanical.com')

  doc.fontSize(18).font('Helvetica-Bold').fillColor('#003366').text('ORDER CONFIRMATION', 290, 50)
  doc.fillColor('#000000')
  lv(doc, 290, 82,  'Confirmation #', 'PO-TEST-NEWVEND-001')
  lv(doc, 290, 110, 'Order Date',     '06/10/2026')
  lv(doc, 290, 138, 'Expected Ship',  '06/15/2026')
  lv(doc, 290, 166, 'Customer PO #',  'PO-TEST-NEWVEND')
  divider(doc, 192)
  lv(doc, 50, 207, 'Ship To', 'Pacific Northwest HVAC Services\n4821 NE Broadway\nPortland OR 97213')
  lv(doc, 290, 207, 'Bill To', 'Pacific Northwest HVAC Services\n4821 NE Broadway\nPortland OR 97213')
  divider(doc, 268)

  const hdrs = { part: 50, desc: 140, qty: 420, uom: 480 }
  let y = 284
  doc.fontSize(8).font('Helvetica-Bold').fillColor('#444444')
  doc.text('PART #', hdrs.part, y); doc.text('DESCRIPTION', hdrs.desc, y)
  doc.text('QTY', hdrs.qty, y, { width: 50, align: 'right' }); doc.text('UOM', hdrs.uom, y)
  divider(doc, y + 14)
  const lines = [
    { part: 'MSM-HTR-075',   desc: 'Unit Heater Natural Gas 75 MBH Horizontal',      qty: 2,  uom: 'EA' },
    { part: 'MSM-VLV-34GAS', desc: 'Gas Shut-Off Ball Valve 3/4" NPT',               qty: 4,  uom: 'EA' },
    { part: 'MSM-FLX-34X12', desc: 'Flexible Gas Connector 3/4" x 12"',              qty: 4,  uom: 'EA' },
    { part: 'MSM-THM-UNITCO', desc: 'Thermostat Unit Heater 40-80°F Line Voltage',   qty: 2,  uom: 'EA' },
    { part: 'MSM-MTG-BRCKT',  desc: 'Heavy Duty Mounting Bracket Kit Adjustable',    qty: 4,  uom: 'EA' },
  ]
  y += 22
  doc.font('Helvetica').fillColor('#000000').fontSize(9)
  for (const l of lines) {
    doc.text(l.part, hdrs.part, y, { width: 85 }); doc.text(l.desc, hdrs.desc, y, { width: 270 })
    doc.text(String(l.qty), hdrs.qty, y, { width: 50, align: 'right' }); doc.text(l.uom, hdrs.uom, y)
    y += 18
  }
  divider(doc, y + 8)
  doc.fontSize(7).fillColor('#888888').text('TEST: New vendor — Mountain States Mechanical Supply is not in QB or Purchasomatic. Expect vendor creation prompt.', 50, y + 18)
  await save(doc, '13-PO-TEST-NEWVEND-001.pdf')
}

// ── 14: PO — vendor includes unit prices and line totals ──────────────────────
// Expected: unit_cost and extended_cost extracted from PO, not null

async function po14WithPrices() {
  const doc = new PDFDocument({ size: 'LETTER', margin: 0 })
  vendorHeader(doc, 'Gensco, Inc.', '3535 Rainier Ave S, Seattle, WA 98144', '(206) 725-6000  |  www.gensco.com')

  doc.fontSize(18).font('Helvetica-Bold').fillColor('#1a3d2b').text('ORDER CONFIRMATION', 290, 50)
  doc.fillColor('#000000')
  lv(doc, 290, 82,  'Order #',       'PO-TEST-WITHPRICES-001')
  lv(doc, 290, 110, 'Order Date',    '06/10/2026')
  lv(doc, 290, 138, 'Expected Ship', '06/13/2026')
  lv(doc, 290, 166, 'Customer PO #', 'PO-2026-1305')
  lv(doc, 290, 194, 'Job',           '2026-Eastside Commercial Retrofit')
  divider(doc, 220)
  lv(doc, 50, 235, 'Bill To', 'Pacific Northwest HVAC Services\n4821 NE Broadway, Portland OR 97213')
  lv(doc, 290, 235, 'Ship To', 'Eastside Properties LLC\n4500 NE Glisan St, Portland OR 97213')
  divider(doc, 278)

  const cols = { part: 50, desc: 130, qty: 330, unit: 380, ext: 460 }
  let y = 294
  doc.fontSize(8).font('Helvetica-Bold').fillColor('#444444')
  doc.text('PART #', cols.part, y); doc.text('DESCRIPTION', cols.desc, y)
  doc.text('QTY', cols.qty, y, { width: 42, align: 'right' })
  doc.text('UNIT', cols.unit, y, { width: 72, align: 'right' })
  doc.text('EXTENDED', cols.ext, y, { width: 85, align: 'right' })
  divider(doc, y + 14)

  const lines = [
    { part: 'CAR-48TCE',  desc: 'Carrier 4-Ton RTU 48TCED08A2A5',          qty: 1, unit: 6840.00 },
    { part: 'GEN-ECON',   desc: 'Economizer Module 48TCE Series',           qty: 1, unit: 425.00  },
    { part: 'REF-410A-25', desc: 'Refrigerant R-410A 25 lb Cylinder',       qty: 6, unit: 87.25   },
    { part: 'CURB-14X56', desc: 'Roof Curb Adapter 14" x 56"',              qty: 1, unit: 245.00  },
    { part: 'THERM-CLI2', desc: 'Carrier ComfortLink II 7-Day Thermostat',  qty: 2, unit: 312.00  },
  ]

  y += 22
  doc.font('Helvetica').fillColor('#000000').fontSize(9)
  let total = 0
  for (const l of lines) {
    const ext = +(l.qty * l.unit).toFixed(2)
    total += ext
    doc.text(l.part, cols.part, y, { width: 75 })
    doc.text(l.desc, cols.desc, y, { width: 192 })
    doc.text(String(l.qty), cols.qty, y, { width: 42, align: 'right' })
    doc.text(`$${l.unit.toFixed(2)}`, cols.unit, y, { width: 72, align: 'right' })
    doc.text(`$${ext.toFixed(2)}`, cols.ext, y, { width: 85, align: 'right' })
    y += 18
  }
  divider(doc, y + 4)
  y += 14
  doc.fontSize(10).font('Helvetica-Bold')
  doc.text('Order Total', cols.unit, y, { width: 72, align: 'right' })
  doc.text(`$${total.toFixed(2)}`, cols.ext, y, { width: 85, align: 'right' })

  doc.fontSize(7).fillColor('#888888').text('TEST: This PO confirmation includes unit pricing and extended totals. Expect unit_cost and extended_cost to be extracted.', 50, y + 30)
  await save(doc, '14-PO-TEST-WITHPRICES-001.pdf')
}

// ── 15: PO — no customer PO reference, no job info ────────────────────────────
// Expected: PO created with no job link, no reference for matching

async function po15NoReference() {
  const doc = new PDFDocument({ size: 'LETTER', margin: 0 })
  vendorHeader(doc, 'Johnstone Supply', '8901 SE Powell Blvd, Portland, OR 97266', '(503) 775-3141')

  doc.fontSize(16).font('Helvetica-Bold').text('ORDER ACKNOWLEDGEMENT', 50, 90)
  doc.fontSize(9).font('Helvetica')
  doc.text('Order Date:   06/10/2026',   50, 116)
  doc.text('Order No.:    PO-TEST-NOREF-001', 50, 130)
  doc.text('Customer:     Pacific Northwest HVAC Services', 50, 144)
  // No "Customer PO" field, no "Job" field
  doc.text('Ship Date:    06/12/2026',   50, 158)
  divider(doc, 175)

  doc.fontSize(8).font('Helvetica-Bold').fillColor('#444444')
  doc.text('DESCRIPTION', 50, 191); doc.text('QTY ORDERED', 390, 191, { width: 80, align: 'right' }); doc.text('STATUS', 480, 191)
  divider(doc, 205)

  const lines = [
    { desc: 'Contactor 24V 40A 2-Pole',              qty: 12, status: 'In Stock'  },
    { desc: 'Capacitor Dual Run 45+5 MFD 440V',      qty: 20, status: 'In Stock'  },
    { desc: 'Hard Start Kit 3-Wire 88-106 MFD',      qty: 10, status: 'In Stock'  },
    { desc: 'Blower Motor 1/3 HP 4-Speed 208-230V',  qty: 6,  status: 'Special Order 3 days' },
    { desc: 'Filter 20x25x1 MERV-8 Case of 12',      qty: 4,  status: 'In Stock'  },
    { desc: 'Condensate Pump Mini-Split 115V',        qty: 8,  status: 'In Stock'  },
  ]

  let y = 215
  doc.font('Helvetica').fillColor('#000000').fontSize(9)
  for (const l of lines) {
    doc.text(l.desc, 50, y, { width: 330 })
    doc.text(String(l.qty), 390, y, { width: 80, align: 'right' })
    doc.text(l.status, 480, y, { width: 110 })
    y += 18
  }
  divider(doc, y + 8)
  doc.fontSize(7).fillColor('#888888').text('TEST: No customer PO reference and no job field. Expect PO created with no job link and no reference for matching.', 50, y + 18)
  await save(doc, '15-PO-TEST-NOREF-001.pdf')
}

// ── 16: PO — job reference that should match existing QB job ──────────────────
// Expected: PO linked to QB job on creation

async function po16JobMatch() {
  const doc = new PDFDocument({ size: 'LETTER', margin: 0 })
  vendorHeader(doc, 'Gensco, Inc.', '3535 Rainier Ave S, Seattle, WA 98144', '(206) 725-6000  |  www.gensco.com')

  doc.fontSize(18).font('Helvetica-Bold').fillColor('#1a3d2b').text('ORDER CONFIRMATION', 290, 50)
  doc.fillColor('#000000')
  lv(doc, 290, 82,  'Order #',       'PO-TEST-JOBMATCH-001')
  lv(doc, 290, 110, 'Order Date',    '06/10/2026')
  lv(doc, 290, 138, 'Expected Ship', '06/14/2026')
  lv(doc, 290, 166, 'Customer PO #', 'PO-2026-1052')
  lv(doc, 290, 194, 'Job',           '2026-Riverside HVAC Upgrade')
  lv(doc, 290, 222, 'Customer',      'Metro Property Group')
  divider(doc, 248)
  lv(doc, 50, 263, 'Bill To', 'Pacific Northwest HVAC Services\n4821 NE Broadway, Portland OR 97213')
  lv(doc, 290, 263, 'Ship To', 'Riverside Apartments\n2240 SE Stark St, Portland OR 97214')
  divider(doc, 304)

  const hdrs = { part: 50, desc: 140, qty: 420, uom: 480 }
  let y = 320
  doc.fontSize(8).font('Helvetica-Bold').fillColor('#444444')
  doc.text('PART #', hdrs.part, y); doc.text('DESCRIPTION', hdrs.desc, y)
  doc.text('QTY', hdrs.qty, y, { width: 50, align: 'right' }); doc.text('UOM', hdrs.uom, y)
  divider(doc, y + 14)
  const lines = [
    { part: 'REF-R22-30',   desc: 'Refrigerant R-22 30 lb Cylinder Reclaimed',   qty: 4,  uom: 'CYL' },
    { part: 'REF-410A-25',  desc: 'Refrigerant R-410A 25 lb Cylinder',           qty: 6,  uom: 'CYL' },
    { part: 'FD-BIFLOW-12', desc: 'Filter Drier Bi-Flow 1/2" Flare R-410A',      qty: 8,  uom: 'EA'  },
    { part: 'SG-12-MHI',    desc: 'Sight Glass Moisture Indicator 1/2" SAE',    qty: 8,  uom: 'EA'  },
  ]
  y += 22
  doc.font('Helvetica').fillColor('#000000').fontSize(9)
  for (const l of lines) {
    doc.text(l.part, hdrs.part, y, { width: 85 }); doc.text(l.desc, hdrs.desc, y, { width: 270 })
    doc.text(String(l.qty), hdrs.qty, y, { width: 50, align: 'right' }); doc.text(l.uom, hdrs.uom, y)
    y += 18
  }
  divider(doc, y + 8)
  doc.fontSize(7).fillColor('#888888').text('TEST: Job "2026-Riverside HVAC Upgrade" should match existing QB job. Expect PO linked to that job on creation.', 50, y + 18)
  await save(doc, '16-PO-TEST-JOBMATCH-001.pdf')
}

// ── 17: PO — 10+ line items ────────────────────────────────────────────────────
// Expected: all lines extracted, receiving checklist has all 10 items

async function po17ManyLines() {
  const doc = new PDFDocument({ size: 'LETTER', margin: 0 })
  vendorHeader(doc, 'Johnstone Supply', '8901 SE Powell Blvd, Portland, OR 97266', '(503) 775-3141')

  doc.fontSize(16).font('Helvetica-Bold').text('ORDER ACKNOWLEDGEMENT', 50, 90)
  doc.fontSize(9).font('Helvetica')
  doc.text('Order Date:   06/10/2026', 50, 116)
  doc.text('Order No.:    PO-TEST-MANYLINES-001', 50, 130)
  doc.text('Customer:     Pacific Northwest HVAC Services', 50, 144)
  doc.text('Customer PO:  PO-2026-1400', 50, 158)
  doc.text('Job:          2026-Eastside Commercial Retrofit', 50, 172)
  divider(doc, 189)

  doc.fontSize(8).font('Helvetica-Bold').fillColor('#444444')
  doc.text('DESCRIPTION', 50, 205); doc.text('QTY ORDERED', 390, 205, { width: 80, align: 'right' }); doc.text('STATUS', 480, 205)
  divider(doc, 219)

  const lines = [
    { desc: 'Contactor 24V 40A 2-Pole',                   qty: 6,  status: 'In Stock'  },
    { desc: 'Hard Start Kit 3-Wire 88-106 MFD',            qty: 4,  status: 'In Stock'  },
    { desc: 'Capacitor Dual Run 45+5 MFD 440V Round',      qty: 10, status: 'In Stock'  },
    { desc: 'Blower Motor 1/3 HP 4-Speed 208-230V',        qty: 3,  status: 'Special Order 3 days' },
    { desc: 'Filter 20x25x1 MERV-8 (Case of 12)',          qty: 2,  status: 'In Stock'  },
    { desc: 'Condensate Pump Mini-Split 115V',             qty: 4,  status: 'In Stock'  },
    { desc: 'TXV Expansion Valve 3/8" x 1/2" R-410A',     qty: 4,  status: 'In Stock'  },
    { desc: 'Service Valve Ball 3/8" Copper',              qty: 8,  status: 'In Stock'  },
    { desc: 'Filter Drier Bi-Flow 1/2" Flare',             qty: 6,  status: 'In Stock'  },
    { desc: 'Sight Glass Moisture Indicator 1/2" SAE',    qty: 6,  status: 'In Stock'  },
    { desc: 'Pressure Switch High 400 PSI Auto-Reset',    qty: 4,  status: 'In Stock'  },
    { desc: 'Pressure Switch Low 10 PSI Manual Reset',    qty: 4,  status: 'In Stock'  },
  ]

  let y = 229
  doc.font('Helvetica').fillColor('#000000').fontSize(9)
  for (const l of lines) {
    doc.text(l.desc, 50, y, { width: 330 })
    doc.text(String(l.qty), 390, y, { width: 80, align: 'right' })
    doc.text(l.status, 480, y, { width: 110 })
    y += 18
  }
  divider(doc, y + 8)
  doc.fontSize(7).fillColor('#888888').text('TEST: 12 line items. Verify all lines extracted and receiving checklist shows all 12 items.', 50, y + 18)
  await save(doc, '17-PO-TEST-MANYLINES-001.pdf')
}

// ── 18: PO — shop stock order, no job ─────────────────────────────────────────
// Expected: PO created with no job_id, appears on PO list as "No job"

async function po18StockOrder() {
  const doc = new PDFDocument({ size: 'LETTER', margin: 0 })
  vendorHeader(doc, 'Johnstone Supply', '8901 SE Powell Blvd, Portland, OR 97266', '(503) 775-3141')

  doc.fontSize(16).font('Helvetica-Bold').text('ORDER ACKNOWLEDGEMENT', 50, 90)
  doc.fontSize(9).font('Helvetica')
  doc.text('Order Date:   06/10/2026', 50, 116)
  doc.text('Order No.:    PO-TEST-STOCKONLY-001', 50, 130)
  doc.text('Customer:     Pacific Northwest HVAC Services', 50, 144)
  // Customer PO reference is explicitly "stock" not a job
  doc.text('Customer PO:  PO-TEST-STOCK-REORDER-Q2-2026', 50, 158)
  doc.text('Notes:        SHOP STOCK REPLENISHMENT — No job assignment', 50, 172)
  divider(doc, 189)

  doc.fontSize(8).font('Helvetica-Bold').fillColor('#444444')
  doc.text('DESCRIPTION', 50, 205); doc.text('QTY', 390, 205, { width: 80, align: 'right' }); doc.text('STATUS', 480, 205)
  divider(doc, 219)

  const lines = [
    { desc: 'Contactor 24V 40A 2-Pole — STOCK',          qty: 24, status: 'In Stock' },
    { desc: 'Capacitor Dual 45+5 MFD 440V — STOCK',      qty: 24, status: 'In Stock' },
    { desc: 'Hard Start Kit 88-106 MFD — STOCK',          qty: 12, status: 'In Stock' },
    { desc: 'Filter 20x25x1 MERV-8 Case of 12 — STOCK',  qty: 6,  status: 'In Stock' },
    { desc: 'Duct Tape Aluminum Foil 2" x 50yd — STOCK', qty: 12, status: 'In Stock' },
    { desc: 'Mastic Sealant 1 Gallon — STOCK',            qty: 6,  status: 'In Stock' },
    { desc: 'Wire Nuts Yellow 100pk — STOCK',             qty: 10, status: 'In Stock' },
    { desc: 'Conduit Strap 1/2" EMT 100pk — STOCK',      qty: 4,  status: 'In Stock' },
  ]

  let y = 229
  doc.font('Helvetica').fillColor('#000000').fontSize(9)
  for (const l of lines) {
    doc.text(l.desc, 50, y, { width: 330 })
    doc.text(String(l.qty), 390, y, { width: 80, align: 'right' })
    doc.text(l.status, 480, y, { width: 110 })
    y += 18
  }
  divider(doc, y + 8)
  doc.fontSize(7).fillColor('#888888').text('TEST: Shop stock replenishment — no job reference. Expect PO created with no job_id. Lines should show "Shop Stock" as job indicator.', 50, y + 18)
  await save(doc, '18-PO-TEST-STOCKONLY-001.pdf')
}

// ── Main ───────────────────────────────────────────────────────────────────────

console.log(`\nGenerating Test Batch 2 → ${OUT_DIR}\n`)
console.log('── INVOICES ──')
await inv01NewVendor()
await inv02CreditNote()
await inv03LineMismatch()
await inv04TaxAsLine()
await inv05Duplicate()
await inv06NoInvoiceNumber()
await inv07NoDate()
await inv08JobMatchHit()
await inv09JobMatchMiss()
await inv10CustomerOnly()
await inv11ManyLines()
await inv12LongDescriptions()
console.log('\n── PURCHASE ORDERS ──')
await po13NewVendor()
await po14WithPrices()
await po15NoReference()
await po16JobMatch()
await po17ManyLines()
await po18StockOrder()

console.log(`
Done — 18 test documents in ${OUT_DIR}

Email routing:
  Invoices 01–12  →  [prefix]-bills@purchasomatic.com
  POs 13–18       →  [prefix]-pos@purchasomatic.com

Key conditions:
  01 New vendor — expect vendor creation prompt
  02 Credit note — expect bill_type = credit_note, pushes as VendorCredit
  03 Line mismatch — expect auto-publish blocked (total off by $50)
  04 Tax as line item — expect tax as regular line, included in line total
  05 Duplicate (same as batch-1 inv 01, GEN-2026-88341) — expect duplicate hold
  06 No invoice number — expect invoice_number = null
  07 No date — expect invoice_date = null
  08 Job match HIT — need "2026-Riverside HVAC Upgrade" job in QB
  09 Job match MISS — expect status = pending_job_match
  10 Customer only — no sub-job
  11 Many lines (12) — verify all extracted
  12 Long descriptions (80+ chars) — verify not truncated
  13 PO new vendor — Mountain States Mechanical Supply
  14 PO with prices — expect unit_cost + extended_cost extracted
  15 PO no reference — expect no job link, no match reference
  16 PO job match — "2026-Riverside HVAC Upgrade" should link to QB job
  17 PO many lines (12) — verify receiving checklist has all 12
  18 PO shop stock — no job, stock replenishment
`)
