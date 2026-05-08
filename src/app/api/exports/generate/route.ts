import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getExportData, formatCurrency, formatDate } from '@/lib/export/generator'
import * as XLSX from 'xlsx'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: company } = await supabase.from('companies').select('company_id').single()
  if (!company) return NextResponse.json({ error: 'No company' }, { status: 404 })

  const url = new URL(req.url)
  const format = url.searchParams.get('format') ?? 'excel'
  const dateStart = url.searchParams.get('dateStart') ?? undefined
  const dateEnd = url.searchParams.get('dateEnd') ?? undefined
  const vendorIds = url.searchParams.get('vendorIds')?.split(',').filter(Boolean)
  const jobIds = url.searchParams.get('jobIds')?.split(',').filter(Boolean)

  const exportData = await getExportData(company.company_id, { dateStart, dateEnd, vendorIds, jobIds })

  if (format === 'excel') {
    return generateExcel(exportData)
  } else {
    return generatePDF(exportData)
  }
}

function generateExcel(exportData: Awaited<ReturnType<typeof getExportData>>) {
  const wb = XLSX.utils.book_new()
  const rows: (string | number)[][] = []

  const header: string[] = ['Job', 'Vendor', 'Invoice #', 'Invoice Date', 'Description', 'Unit Cost', 'Qty', 'Amount']
  rows.push(header)

  for (const job of exportData.sections) {
    const jobLabel = [job.jobNumber, job.jobName, job.customerName].filter(Boolean).join(' – ')
    for (const vendor of job.vendors) {
      for (const li of vendor.lineItems) {
        rows.push([
          jobLabel,
          vendor.vendorName,
          vendor.invoiceNumber ?? '',
          formatDate(vendor.invoiceDate),
          li.description ?? '',
          li.unit_cost ?? '',
          li.quantity != null ? `(${li.quantity})` : '',
          li.extended_cost ?? '',
        ])
      }
      // Vendor subtotal row
      rows.push(['', '', '', '', `${vendor.vendorName} Total`, '', '', vendor.vendorTotal])
    }
    // Job total row
    rows.push([`${jobLabel} — Total`, '', '', '', '', '', '', job.jobTotal])
    rows.push([]) // blank row between jobs
  }

  const ws = XLSX.utils.aoa_to_sheet(rows)

  // Column widths
  ws['!cols'] = [
    { wch: 30 }, { wch: 20 }, { wch: 14 }, { wch: 14 },
    { wch: 40 }, { wch: 12 }, { wch: 8 }, { wch: 12 },
  ]

  XLSX.utils.book_append_sheet(wb, ws, 'Materials Entry')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="materials-entry-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  })
}

async function generatePDF(exportData: Awaited<ReturnType<typeof getExportData>>) {
  // Dynamic import of pdfkit to avoid issues with edge runtime
  const PDFDocument = (await import('pdfkit')).default
  const chunks: Buffer[] = []

  return new Promise<NextResponse>((resolve) => {
    const doc = new PDFDocument({ margin: 40, size: 'LETTER' })

    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => {
      const buf = Buffer.concat(chunks)
      resolve(new NextResponse(buf, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="materials-entry-${new Date().toISOString().slice(0, 10)}.pdf"`,
        },
      }))
    })

    // Title
    doc.fontSize(16).font('Helvetica-Bold').text('Materials Entry Export', { align: 'center' })
    doc.fontSize(10).font('Helvetica').text(
      `Generated ${formatDate(new Date().toISOString().slice(0, 10))}` +
      (exportData.dateRangeStart ? ` · ${formatDate(exportData.dateRangeStart)}` : '') +
      (exportData.dateRangeEnd ? ` – ${formatDate(exportData.dateRangeEnd)}` : ''),
      { align: 'center' }
    )
    doc.moveDown(1.5)

    for (const job of exportData.sections) {
      const jobLabel = [job.jobNumber, job.jobName, job.customerName].filter(Boolean).join(' – ')

      // Job header
      doc.fontSize(12).font('Helvetica-Bold').text(jobLabel)
      doc.moveTo(40, doc.y).lineTo(572, doc.y).stroke()
      doc.moveDown(0.3)

      for (const vendor of job.vendors) {
        // Vendor subheader
        doc.fontSize(10).font('Helvetica-Bold')
          .text(`${vendor.vendorName}`, { continued: true })
          .font('Helvetica').fillColor('#666')
          .text(`  Invoice ${vendor.invoiceNumber ?? '—'}  ·  ${formatDate(vendor.invoiceDate)}`)
          .fillColor('black')
        doc.moveDown(0.2)

        for (const li of vendor.lineItems) {
          const qtyStr = li.quantity != null ? ` (${li.quantity})` : ''
          const amtStr = formatCurrency(li.extended_cost)
          doc.fontSize(9).font('Helvetica')
          const descX = 48
          const amtX = 532
          const y = doc.y
          doc.text(li.description ?? '', descX, y, { width: 380 })
          doc.text(amtStr + qtyStr, amtX - 60, y, { width: 60, align: 'right' })
          doc.moveDown(0.1)
        }

        // Vendor total
        doc.fontSize(9).font('Helvetica-Bold')
          .text(`${vendor.vendorName} Total`, 48, doc.y, { continued: true, width: 380 })
          .text(formatCurrency(vendor.vendorTotal), { align: 'right' })
        doc.moveDown(0.4)
      }

      // Job total
      doc.fontSize(10).font('Helvetica-Bold')
        .text(`${jobLabel} — Total`, 40, doc.y, { continued: true, width: 430 })
        .text(formatCurrency(job.jobTotal), { align: 'right' })
      doc.moveDown(1)

      if (doc.y > 700) doc.addPage()
    }

    if (exportData.sections.length === 0) {
      doc.fontSize(10).font('Helvetica').fillColor('#888')
        .text('No published bills found for the selected filters.', { align: 'center' })
    }

    doc.end()
  })
}
