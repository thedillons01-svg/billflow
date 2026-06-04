import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getExportData, formatCurrency, formatDate, type ExportData, type ExportJobSection } from '@/lib/export/generator'
import * as XLSX from 'xlsx'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: company } = await supabase.from('companies').select('company_id').single()
  if (!company) return NextResponse.json({ error: 'No company' }, { status: 404 })

  const url        = new URL(req.url)
  const format     = url.searchParams.get('format') ?? 'excel'
  const dateStart  = url.searchParams.get('dateStart') ?? undefined
  const dateEnd    = url.searchParams.get('dateEnd')   ?? undefined
  const vendorIds  = url.searchParams.get('vendorIds')?.split(',').filter(Boolean)
  const jobIds     = url.searchParams.get('jobIds')?.split(',').filter(Boolean)
  const includePOs        = url.searchParams.get('includePOs')        !== 'false'
  const includeReceiving  = url.searchParams.get('includeReceiving')  !== 'false'
  const includeInvoiced   = url.searchParams.get('includeInvoiced')   !== 'false'
  const includeClosedJobs = url.searchParams.get('includeClosedJobs') === 'true'

  const exportData = await getExportData(company.company_id, {
    dateStart, dateEnd, vendorIds, jobIds,
    includePOs, includeReceiving, includeInvoiced, includeClosedJobs,
  })

  return format === 'excel' ? generateExcel(exportData) : generatePDF(exportData)
}

// ── Helpers ────────────────────────────────────────────────────────────

function jobLabel(job: ExportJobSection) {
  return [job.jobNumber, job.jobName, job.customerName].filter(Boolean).join(' – ')
}

function receivingStatus(status: string, qty: number, ordered: number | null) {
  if (status === 'received') return `Received (x${qty})`
  if (status === 'partial')  return `Partial (x${qty}${ordered != null ? ` of ${ordered}` : ''})`
  return 'Not received'
}

// ── Excel ──────────────────────────────────────────────────────────────

function generateExcel(d: ExportData) {
  const wb   = XLSX.utils.book_new()
  const rows: (string | number | null)[][] = []
  const { include } = d
  const multi = [include.pos, include.receiving, include.invoiced].filter(Boolean).length > 1

  rows.push([
    'Job', ...(multi ? ['Type'] : []),
    'Vendor', 'Reference', 'Date', 'Description',
    'Ord Qty', 'Rcvd Qty', 'Unit Cost', 'Amount',
  ])

  for (const job of d.sections) {
    const jl = jobLabel(job)

    const row = (type: string, vendor: string, ref: string, date: string, desc: string,
      ordQty: number | string | null, rcvQty: number | string | null,
      unitCost: number | null, amount: number | null) =>
      [jl, ...(multi ? [type] : []), vendor, ref, date, desc, ordQty, rcvQty, unitCost, amount]

    if (include.pos) {
      for (const po of job.poRecords) {
        for (const l of po.lines) {
          rows.push(row('Purchase Order', po.vendorName, po.poNumber ?? '', formatDate(po.orderDate),
            l.description ?? '', l.quantityOrdered, null, l.unitCost, null))
        }
      }
    }

    if (include.receiving) {
      for (const recv of job.receivingRecords) {
        for (const l of recv.lines) {
          rows.push(row('Receiving', recv.vendorName, recv.poNumber ?? '',
            formatDate(recv.receivedAt?.slice(0, 10)),
            l.description ?? '', l.quantityOrdered,
            receivingStatus(l.status, l.quantityReceived, l.quantityOrdered),
            null, null))
        }
      }
    }

    if (include.invoiced) {
      for (const inv of job.invoicedRecords) {
        for (const l of inv.lines) {
          rows.push(row('Invoice', inv.vendorName, inv.invoiceNumber ?? '', formatDate(inv.invoiceDate),
            l.description ?? '', l.quantity, null, l.unitCost, l.extendedCost))
        }
      }
      if (job.totalInvoiced > 0)
        rows.push([`${jl} — Total Invoiced`, ...(multi ? [''] : []), '', '', '', '', '', '', '', job.totalInvoiced])
    }

    rows.push([])
  }

  const ws = XLSX.utils.aoa_to_sheet(rows)
  const colCount = multi ? 10 : 9
  ws['!cols'] = [
    { wch: 32 }, ...(multi ? [{ wch: 14 }] : []),
    { wch: 20 }, { wch: 14 }, { wch: 14 }, { wch: 44 },
    { wch: 9 }, { wch: 16 }, { wch: 12 }, { wch: 12 },
  ].slice(0, colCount)

  XLSX.utils.book_append_sheet(wb, ws, 'Materials Entry')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="materials-entry-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  })
}

// ── PDF ────────────────────────────────────────────────────────────────

async function generatePDF(d: ExportData) {
  const PDFDocument = (await import('pdfkit')).default
  const chunks: Buffer[] = []
  const { include } = d
  const multi = [include.pos, include.receiving, include.invoiced].filter(Boolean).length > 1

  return new Promise<NextResponse>(resolve => {
    const doc = new PDFDocument({ margin: 40, size: 'LETTER' })
    doc.on('data', (c: Buffer) => chunks.push(c))
    doc.on('end', () => {
      const buf = Buffer.concat(chunks)
      resolve(new NextResponse(buf, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="materials-entry-${new Date().toISOString().slice(0, 10)}.pdf"`,
        },
      }))
    })

    const L = 40, R = 572, W = R - L
    const gray = (v: number) => `#${v.toString(16).padStart(2, '0').repeat(3)}`

    // Title
    doc.fontSize(15).font('Helvetica-Bold').text('Materials Entry Export', { align: 'center' })
    doc.fontSize(9).font('Helvetica').fillColor(gray(100))
      .text(
        `Generated ${formatDate(new Date().toISOString().slice(0, 10))}` +
        (d.dateRangeStart ? `  ·  From ${formatDate(d.dateRangeStart)}` : '') +
        (d.dateRangeEnd   ? `  –  ${formatDate(d.dateRangeEnd)}`        : ''),
        { align: 'center' }
      )
    doc.fillColor('black').moveDown(1.2)

    if (d.sections.length === 0) {
      doc.fontSize(10).font('Helvetica').fillColor(gray(130))
        .text('No records found for the selected filters.', { align: 'center' })
      doc.end()
      return
    }

    for (const job of d.sections) {
      const jl = jobLabel(job)
      if (doc.y > 660) doc.addPage()

      // Job header bar
      doc.fontSize(11).font('Helvetica-Bold').fillColor('black').text(jl)
      doc.moveTo(L, doc.y).lineTo(R, doc.y).lineWidth(0.5).stroke()
      doc.moveDown(0.4)

      // ── PURCHASE ORDERS section ──────────────────────────────────
      if (include.pos && job.poRecords.length > 0) {
        if (multi) {
          doc.fontSize(8).font('Helvetica-Bold').fillColor(gray(100))
            .text('PURCHASE ORDERS', L + 8)
          doc.fillColor('black').moveDown(0.3)
        }

        for (const po of job.poRecords) {
          const poHasPricing = po.lines.some(l => l.unitCost != null)
          const hdr = [
            po.vendorName,
            po.poNumber ? `PO ${po.poNumber}` : null,
            po.orderDate ? `Ordered ${formatDate(po.orderDate)}` : null,
            po.orderedBy ? `by ${po.orderedBy}` : null,
          ].filter(Boolean).join('  ·  ')

          doc.fontSize(9).font('Helvetica-Bold').fillColor('black')
            .text(hdr, L + 16, doc.y)
          doc.moveDown(0.15)

          for (const l of po.lines) {
            const qtyStr  = l.quantityOrdered != null ? `(x${l.quantityOrdered})` : ''
            const costStr = poHasPricing && l.unitCost != null ? formatCurrency(l.unitCost) : ''
            const descX = L + 24
            const y = doc.y
            doc.fontSize(9).font('Helvetica').fillColor(gray(30))
              .text(l.description ?? '—', descX, y, { width: W - 100, lineBreak: false })
            if (poHasPricing)
              doc.text(costStr, R - 110, y, { width: 50, align: 'right' })
            doc.text(qtyStr, R - 55, y, { width: 55, align: 'right' })
            doc.moveDown(0.25)
          }
          doc.moveDown(0.3)
        }
      }

      // ── RECEIVING section ────────────────────────────────────────
      if (include.receiving && job.receivingRecords.length > 0) {
        if (multi) {
          doc.fontSize(8).font('Helvetica-Bold').fillColor(gray(100))
            .text('RECEIVING', L + 8)
          doc.fillColor('black').moveDown(0.3)
        }

        for (const recv of job.receivingRecords) {
          const hdr = [
            recv.vendorName,
            recv.poNumber ? `PO ${recv.poNumber}` : null,
            recv.receivedAt ? `Received ${formatDate(recv.receivedAt.slice(0, 10))}` : null,
            recv.receivedBy ? `by ${recv.receivedBy}` : null,
          ].filter(Boolean).join('  ·  ')

          doc.fontSize(9).font('Helvetica-Bold').fillColor('black')
            .text(hdr, L + 16, doc.y)
          doc.moveDown(0.15)

          for (const l of recv.lines) {
            const statusStr = receivingStatus(l.status, l.quantityReceived, l.quantityOrdered)
            const y = doc.y
            const statusColor = l.status === 'received' ? '#059669' : l.status === 'partial' ? '#D97706' : gray(130)
            doc.fontSize(9).font('Helvetica').fillColor(gray(30))
              .text(l.description ?? '—', L + 24, y, { width: W - 120, lineBreak: false })
            doc.fillColor(statusColor).font('Helvetica-Bold')
              .text(statusStr, R - 90, y, { width: 90, align: 'right' })
            doc.fillColor('black').font('Helvetica').moveDown(0.25)
          }
          doc.moveDown(0.3)
        }
      }

      // ── INVOICED section ─────────────────────────────────────────
      if (include.invoiced && job.invoicedRecords.length > 0) {
        if (multi) {
          doc.fontSize(8).font('Helvetica-Bold').fillColor(gray(100))
            .text('INVOICED', L + 8)
          doc.fillColor('black').moveDown(0.3)
        }

        for (const inv of job.invoicedRecords) {
          const hdr = [
            inv.vendorName,
            inv.invoiceNumber ? `Invoice #${inv.invoiceNumber}` : null,
            formatDate(inv.invoiceDate),
          ].filter(Boolean).join('  ·  ')

          doc.fontSize(9).font('Helvetica-Bold').fillColor('black')
            .text(hdr, L + 16, doc.y)
          doc.moveDown(0.15)

          for (const l of inv.lines) {
            const qtyStr  = l.quantity != null ? `(x${l.quantity})` : ''
            const costStr = l.unitCost     != null ? formatCurrency(l.unitCost)     : ''
            const amtStr  = l.extendedCost != null ? formatCurrency(l.extendedCost) : ''
            const y = doc.y
            doc.fontSize(9).font('Helvetica').fillColor(gray(30))
              .text(l.description ?? '—', L + 24, y, { width: W - 160, lineBreak: false })
            doc.text(costStr, R - 130, y, { width: 55, align: 'right' })
            doc.text(amtStr,  R - 70,  y, { width: 50, align: 'right' })
            doc.fillColor(gray(100)).text(qtyStr, R - 15, y, { width: 15 })
            doc.fillColor('black').moveDown(0.25)
          }
          doc.moveDown(0.2)
        }

        // Job invoiced total
        doc.fontSize(9).font('Helvetica-Bold')
          .text(`${jl}  —  Total Invoiced Materials: ${formatCurrency(job.totalInvoiced)}`,
            L, doc.y, { align: 'right' })
      }

      doc.moveDown(1)
      if (doc.y > 680) doc.addPage()
    }

    doc.end()
  })
}
