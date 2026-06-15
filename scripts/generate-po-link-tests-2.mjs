/**
 * Second batch of PO + Bill PDF test pairs.
 *
 * Usage: node scripts/generate-po-link-tests-2.mjs
 * Output: scripts/test-pdfs-po-link/
 *
 *   PAIR D — Winsupply of Portland, clean match
 *     WIN-PO-2026-3301  |  no discrepancies
 *
 *   PAIR E — Gensco Inc., extra line item on invoice (not on PO)
 *     GEN-PO-2026-7720  |  invoice has a freight charge not on the PO
 *
 *   PAIR F — Carrier Enterprise, missing line item (on PO but not invoiced)
 *     CAR-PO-2026-1155  |  one PO line not included on invoice yet
 */

import PDFDocument from 'pdfkit'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR = path.join(__dirname, 'test-pdfs-po-link')
fs.mkdirSync(OUT_DIR, { recursive: true })

function save(doc, filename) {
  return new Promise((resolve, reject) => {
    const out = path.join(OUT_DIR, filename)
    const stream = fs.createWriteStream(out)
    doc.pipe(stream)
    doc.end()
    stream.on('finish', () => { console.log(`  ✓  ${filename}`); resolve() })
    stream.on('error', reject)
  })
}

function lv(doc, x, y, label, value) {
  doc.fontSize(8).font('Helvetica-Bold').fillColor('#555555').text(label, x, y)
  doc.fontSize(10).font('Helvetica').fillColor('#000000').text(value, x, y + 12)
}

function divider(doc, y) {
  doc.moveTo(50, y).lineTo(545, y).strokeColor('#cccccc').lineWidth(0.5).stroke()
}

function lineTable(doc, startY, items) {
  const C = { desc: 50, qty: 290, unit: 360, ext: 460 }

  doc.fontSize(8).font('Helvetica-Bold').fillColor('#444444')
  doc.text('DESCRIPTION', C.desc, startY)
  doc.text('QTY',         C.qty,  startY, { width: 60,  align: 'right' })
  doc.text('UNIT PRICE',  C.unit, startY, { width: 90,  align: 'right' })
  doc.text('TOTAL',       C.ext,  startY, { width: 85,  align: 'right' })
  divider(doc, startY + 14)

  let y = startY + 20
  let subtotal = 0
  doc.fillColor('#000000')

  for (const item of items) {
    const ext = +(item.qty * item.unit).toFixed(2)
    subtotal += ext
    doc.fontSize(9).font('Helvetica')
    doc.text(item.desc,                C.desc, y, { width: 230 })
    doc.text(String(item.qty),         C.qty,  y, { width: 60,  align: 'right' })
    doc.text(`$${item.unit.toFixed(2)}`, C.unit, y, { width: 90, align: 'right' })
    doc.text(`$${ext.toFixed(2)}`,     C.ext,  y, { width: 85,  align: 'right' })
    y += 16
  }

  divider(doc, y + 4)
  y += 14

  const tax = +(subtotal * 0.085).toFixed(2)
  const total = +(subtotal + tax).toFixed(2)

  doc.fontSize(9).font('Helvetica').fillColor('#555555')
  doc.text('Subtotal',        C.unit, y, { width: 90, align: 'right' })
  doc.text(`$${subtotal.toFixed(2)}`, C.ext, y, { width: 85, align: 'right' })
  y += 14
  doc.text('Sales Tax (8.5%)', C.unit, y, { width: 90, align: 'right' })
  doc.text(`$${tax.toFixed(2)}`,      C.ext, y, { width: 85, align: 'right' })
  y += 14
  doc.font('Helvetica-Bold').fillColor('#000000')
  doc.text('TOTAL',           C.unit, y, { width: 90, align: 'right' })
  doc.text(`$${total.toFixed(2)}`,    C.ext, y, { width: 85, align: 'right' })

  return { y: y + 20, total }
}

// ══════════════════════════════════════════════════════════════════════════════
// PAIR D — Winsupply of Portland, clean match
// PO#: WIN-PO-2026-3301
// ══════════════════════════════════════════════════════════════════════════════

const PAIR_D_ITEMS = [
  { desc: 'Copper Pipe Type L 3/4" x 10ft',              qty: 20,  unit:  18.90 },
  { desc: 'Ball Valve 3/4" Full Port Brass',              qty:  8,  unit:  12.45 },
  { desc: 'Sweat Coupling 3/4" Wrought Copper',           qty: 50,  unit:   0.88 },
  { desc: 'Pressure Gauge 0-200 PSI 1/4" NPT Bottom',    qty:  4,  unit:  14.25 },
  { desc: 'Pipe Insulation 3/4" ID x 3/8" wall 6ft',     qty: 15,  unit:   4.60 },
]

async function pairD_PO() {
  const doc = new PDFDocument({ size: 'LETTER', margin: 0 })

  doc.fontSize(16).font('Helvetica-Bold').text('Winsupply of Portland', 50, 50)
  doc.fontSize(9).font('Helvetica').fillColor('#555555')
  doc.text('14730 NW Cornell Rd, Portland OR 97229', 50, 70)
  doc.text('(503) 614-9100  |  winsupply.com', 50, 82)
  doc.fillColor('#000000')

  doc.fontSize(18).font('Helvetica-Bold').fillColor('#E65C00').text('ORDER CONFIRMATION', 280, 50)
  doc.fillColor('#000000')

  lv(doc, 280, 82,  'Order #',        'WIN-PO-2026-3301')
  lv(doc, 280, 110, 'Order Date',     '06/12/2026')
  lv(doc, 280, 138, 'Est. Ship Date', '06/14/2026')
  lv(doc, 280, 166, 'Your PO #',      'WIN-PO-2026-3301')
  divider(doc, 192)

  lv(doc, 50, 207, 'Ship To',
    'Cascade Comfort HVAC\n1845 SE Burnside St\nPortland OR 97214')
  lv(doc, 280, 207, 'Job', 'Riverfront Apartment Complex — Unit Replacements')
  divider(doc, 260)

  lineTable(doc, 276, PAIR_D_ITEMS)

  doc.fontSize(7).fillColor('#888888')
    .text('TEST PAIR D — Clean match (Winsupply). Send to POs first, then invoice to Bills. Expect: bill linked, no discrepancy flags.', 50, 670, { width: 495 })

  await save(doc, 'PO-LINK-D-po-confirmation.pdf')
}

async function pairD_Invoice() {
  const doc = new PDFDocument({ size: 'LETTER', margin: 0 })

  doc.fontSize(16).font('Helvetica-Bold').text('Winsupply of Portland', 50, 50)
  doc.fontSize(9).font('Helvetica').fillColor('#555555')
  doc.text('14730 NW Cornell Rd, Portland OR 97229', 50, 70)
  doc.text('(503) 614-9100  |  winsupply.com', 50, 82)
  doc.fillColor('#000000')

  doc.fontSize(20).font('Helvetica-Bold').text('INVOICE', 390, 50)

  lv(doc, 390, 80,  'Invoice #',    'WIN-INV-2026-44821')
  lv(doc, 390, 108, 'Invoice Date', '06/14/2026')
  lv(doc, 390, 136, 'Due Date',     '07/14/2026')
  lv(doc, 390, 164, 'Customer PO #', 'WIN-PO-2026-3301')
  divider(doc, 190)

  lv(doc, 50, 205, 'Bill To',
    'Cascade Comfort HVAC\n1845 SE Burnside St\nPortland OR 97214')
  lv(doc, 280, 205, 'Job Reference', 'Riverfront Apartment Complex — Unit Replacements')
  divider(doc, 252)

  lineTable(doc, 268, PAIR_D_ITEMS)

  doc.fontSize(7).fillColor('#888888')
    .text('TEST PAIR D — Exact match to WIN-PO-2026-3301. Expect: bill linked to PO, no discrepancies.', 50, 670, { width: 495 })

  await save(doc, 'PO-LINK-D-invoice.pdf')
}

// ══════════════════════════════════════════════════════════════════════════════
// PAIR E — Gensco Inc., EXTRA LINE ITEM on invoice (freight charge not on PO)
// PO#: GEN-PO-2026-7720
// ══════════════════════════════════════════════════════════════════════════════

const PAIR_E_PO_ITEMS = [
  { desc: 'Trane TXV Kit BAYEVAP001A',                   qty: 6,  unit: 84.50 },
  { desc: 'Filter Drier 21213 Catch-All 5/8" Sweat',     qty: 6,  unit: 18.75 },
  { desc: 'Blower Wheel 10x6 CW 1/2" Bore',              qty: 4,  unit: 42.00 },
]

const PAIR_E_INV_ITEMS = [
  { desc: 'Trane TXV Kit BAYEVAP001A',                   qty: 6,  unit: 84.50 },
  { desc: 'Filter Drier 21213 Catch-All 5/8" Sweat',     qty: 6,  unit: 18.75 },
  { desc: 'Blower Wheel 10x6 CW 1/2" Bore',              qty: 4,  unit: 42.00 },
  { desc: 'Freight / Handling',                          qty: 1,  unit: 35.00 },  // ← not on PO
]

async function pairE_PO() {
  const doc = new PDFDocument({ size: 'LETTER', margin: 0 })

  doc.fontSize(16).font('Helvetica-Bold').text('Gensco Inc.', 50, 50)
  doc.fontSize(9).font('Helvetica').fillColor('#555555')
  doc.text('9600 N Burgard St, Portland OR 97203', 50, 70)
  doc.text('(503) 285-2181  |  gensco.com', 50, 82)
  doc.fillColor('#000000')

  doc.fontSize(18).font('Helvetica-Bold').fillColor('#1B4D8E').text('PURCHASE ORDER CONFIRMATION', 230, 50)
  doc.fillColor('#000000')

  lv(doc, 280, 82,  'PO Number',     'GEN-PO-2026-7720')
  lv(doc, 280, 110, 'Date Ordered',  '06/11/2026')
  lv(doc, 280, 138, 'Expected Ship', '06/16/2026')
  lv(doc, 280, 166, 'Reference',     'GEN-PO-2026-7720')
  divider(doc, 192)

  lv(doc, 50, 207, 'Deliver To',
    'Cascade Comfort HVAC\n1845 SE Burnside St\nPortland OR 97214')
  lv(doc, 280, 207, 'Job', 'Eastside Medical Plaza — HVAC Retrofit')
  divider(doc, 258)

  lineTable(doc, 274, PAIR_E_PO_ITEMS)

  doc.fontSize(7).fillColor('#888888')
    .text('TEST PAIR E — Extra line item. Invoice (PO-LINK-E-invoice.pdf) adds a $35 freight charge not on this PO. Expect: bill linked, freight line flagged as not-on-PO.', 50, 670, { width: 495 })

  await save(doc, 'PO-LINK-E-po-confirmation.pdf')
}

async function pairE_Invoice() {
  const doc = new PDFDocument({ size: 'LETTER', margin: 0 })

  doc.fontSize(16).font('Helvetica-Bold').text('Gensco Inc.', 50, 50)
  doc.fontSize(9).font('Helvetica').fillColor('#555555')
  doc.text('9600 N Burgard St, Portland OR 97203', 50, 70)
  doc.text('(503) 285-2181  |  gensco.com', 50, 82)
  doc.fillColor('#000000')

  doc.fontSize(20).font('Helvetica-Bold').text('INVOICE', 390, 50)

  lv(doc, 390, 80,  'Invoice #',     'GEN-2026-551940')
  lv(doc, 390, 108, 'Invoice Date',  '06/16/2026')
  lv(doc, 390, 136, 'Due Date',      '07/16/2026')
  lv(doc, 390, 164, 'Your PO #',     'GEN-PO-2026-7720')
  divider(doc, 190)

  lv(doc, 50, 205, 'Sold To',
    'Cascade Comfort HVAC\n1845 SE Burnside St\nPortland OR 97214')
  lv(doc, 280, 205, 'Job', 'Eastside Medical Plaza — HVAC Retrofit')
  divider(doc, 252)

  lineTable(doc, 268, PAIR_E_INV_ITEMS)

  doc.fontSize(7).fillColor('#888888')
    .text('TEST PAIR E — Invoice adds Freight/Handling ($35) not on GEN-PO-2026-7720. Expect: bill linked, freight line flagged as extra charge.', 50, 670, { width: 495 })

  await save(doc, 'PO-LINK-E-invoice.pdf')
}

// ══════════════════════════════════════════════════════════════════════════════
// PAIR F — Carrier Enterprise, PARTIAL DELIVERY (one PO line not on invoice)
// PO#: CAR-PO-2026-1155
// ══════════════════════════════════════════════════════════════════════════════

const PAIR_F_PO_ITEMS = [
  { desc: 'Carrier 24ACC636A003 3-Ton AC Condenser',        qty: 2,  unit: 1640.00 },
  { desc: 'Carrier CNPHP3617ATA 3-Ton Cased Evap Coil',     qty: 2,  unit:  520.00 },
  { desc: 'Carrier SYSTXCCUID01-B Infinity System Control',  qty: 2,  unit:  285.00 },
]

const PAIR_F_INV_ITEMS = [
  { desc: 'Carrier 24ACC636A003 3-Ton AC Condenser',        qty: 2,  unit: 1640.00 },
  { desc: 'Carrier CNPHP3617ATA 3-Ton Cased Evap Coil',     qty: 2,  unit:  520.00 },
  // Systxccuid controls on backorder — not on this invoice
]

async function pairF_PO() {
  const doc = new PDFDocument({ size: 'LETTER', margin: 0 })

  doc.fontSize(16).font('Helvetica-Bold').text('Carrier Enterprise', 50, 50)
  doc.fontSize(9).font('Helvetica').fillColor('#555555')
  doc.text('10415 SW Cascade Ave, Tigard OR 97223', 50, 70)
  doc.text('(503) 624-1800  |  carrierenterprise.com', 50, 82)
  doc.fillColor('#000000')

  doc.fontSize(18).font('Helvetica-Bold').fillColor('#004B87').text('ORDER CONFIRMATION', 280, 50)
  doc.fillColor('#000000')

  lv(doc, 280, 82,  'Order #',       'CAR-PO-2026-1155')
  lv(doc, 280, 110, 'Order Date',    '06/10/2026')
  lv(doc, 280, 138, 'Ship Date',     '06/13/2026')
  lv(doc, 280, 166, 'Customer PO #', 'CAR-PO-2026-1155')
  divider(doc, 192)

  lv(doc, 50, 207, 'Ship To',
    'Cascade Comfort HVAC\n1845 SE Burnside St\nPortland OR 97214')
  lv(doc, 280, 207, 'Job', 'Parkview Dental Office — Full System Install')
  divider(doc, 258)

  lineTable(doc, 274, PAIR_F_PO_ITEMS)

  doc.fontSize(9).font('Helvetica-Bold').fillColor('#CC0000')
    .text('NOTE: Infinity System Controls (line 3) are backordered. Separate shipment and invoice to follow.', 50, 540, { width: 495 })
  doc.fillColor('#000000')

  doc.fontSize(7).fillColor('#888888')
    .text('TEST PAIR F — Partial delivery. Controls on backorder — invoice (PO-LINK-F-invoice.pdf) covers only condensers and coils. Expect: bill linked, PO line 3 unfulfilled/missing.', 50, 670, { width: 495 })

  await save(doc, 'PO-LINK-F-po-confirmation.pdf')
}

async function pairF_Invoice() {
  const doc = new PDFDocument({ size: 'LETTER', margin: 0 })

  doc.fontSize(16).font('Helvetica-Bold').text('Carrier Enterprise', 50, 50)
  doc.fontSize(9).font('Helvetica').fillColor('#555555')
  doc.text('10415 SW Cascade Ave, Tigard OR 97223', 50, 70)
  doc.text('(503) 624-1800  |  carrierenterprise.com', 50, 82)
  doc.fillColor('#000000')

  doc.fontSize(20).font('Helvetica-Bold').text('INVOICE', 390, 50)

  lv(doc, 390, 80,  'Invoice #',     'CAR-INV-2026-88231')
  lv(doc, 390, 108, 'Invoice Date',  '06/13/2026')
  lv(doc, 390, 136, 'Due Date',      '07/13/2026')
  lv(doc, 390, 164, 'Your PO #',     'CAR-PO-2026-1155')
  divider(doc, 190)

  lv(doc, 50, 205, 'Bill To',
    'Cascade Comfort HVAC\n1845 SE Burnside St\nPortland OR 97214')
  lv(doc, 280, 205, 'Job', 'Parkview Dental Office — Full System Install')
  divider(doc, 252)

  lineTable(doc, 268, PAIR_F_INV_ITEMS)

  doc.fontSize(9).font('Helvetica-Bold').fillColor('#CC0000')
    .text('Infinity System Controls (2 units) are on backorder. A separate invoice will be issued upon shipment.', 50, 480, { width: 495 })
  doc.fillColor('#000000')

  doc.fontSize(7).fillColor('#888888')
    .text('TEST PAIR F — Partial shipment against CAR-PO-2026-1155. Controls not included. Expect: bill linked to PO, PO line 3 shown as unfulfilled.', 50, 670, { width: 495 })

  await save(doc, 'PO-LINK-F-invoice.pdf')
}

// ── Run ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\nGenerating PO ↔ Invoice test pairs (batch 2)...\n')
  console.log('PAIR D — Winsupply of Portland (clean match):')
  await pairD_PO()
  await pairD_Invoice()
  console.log('PAIR E — Gensco Inc. (extra line on invoice):')
  await pairE_PO()
  await pairE_Invoice()
  console.log('PAIR F — Carrier Enterprise (partial delivery):')
  await pairF_PO()
  await pairF_Invoice()
  console.log(`\nAll 6 files written to ${OUT_DIR}\n`)
  console.log('UPLOAD ORDER: send *-po-confirmation.pdf to [prefix]-pos@, then *-invoice.pdf to [prefix]-bills@\n')
  console.log('PAIR D: WIN-PO-2026-3301  — Winsupply, clean match, 5 line items')
  console.log('PAIR E: GEN-PO-2026-7720  — Gensco, freight charge on invoice not on PO')
  console.log('PAIR F: CAR-PO-2026-1155  — Carrier, Infinity controls on backorder (3rd PO line missing from invoice)\n')
}

main().catch(err => { console.error(err); process.exit(1) })
