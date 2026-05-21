import 'server-only'
import PDFDocument from 'pdfkit'
import * as XLSX from 'xlsx'

export type FileCategory = 'pdf' | 'image' | 'text' | 'excel' | 'unsupported'

export const SUPPORTED_TYPES_LABEL =
  'PDFs, images (JPG, PNG, TIFF, WEBP), Excel files (XLS, XLSX), and text files (TXT, CSV)'

export function getFileCategory(contentType: string, filename: string): FileCategory {
  const name = (filename ?? '').toLowerCase()
  const type = (contentType ?? '').toLowerCase().split(';')[0].trim()

  if (type === 'application/pdf' || name.endsWith('.pdf')) return 'pdf'

  if (
    type.startsWith('image/') ||
    ['.jpg', '.jpeg', '.png', '.tiff', '.tif', '.webp', '.gif'].some(e => name.endsWith(e))
  ) return 'image'

  if (
    ['text/plain', 'text/csv', 'application/csv'].includes(type) ||
    ['.txt', '.csv'].some(e => name.endsWith(e))
  ) return 'text'

  if (
    [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel.sheet.macroEnabled.12',
    ].includes(type) ||
    ['.xls', '.xlsx', '.xlsm'].some(e => name.endsWith(e))
  ) return 'excel'

  return 'unsupported'
}

export async function convertToPdf(
  buffer: Buffer,
  contentType: string,
  filename: string,
): Promise<Buffer> {
  const category = getFileCategory(contentType, filename)
  switch (category) {
    case 'pdf':    return buffer
    case 'image':  return imageToPdf(buffer, contentType, filename)
    case 'text':   return textToPdf(buffer.toString('utf-8'))
    case 'excel':  return excelToPdf(buffer)
    default:       throw new Error(`Unsupported file type: ${filename}`)
  }
}

async function imageToPdf(buffer: Buffer, contentType: string, filename: string): Promise<Buffer> {
  const name = filename.toLowerCase()
  const type = contentType.toLowerCase()

  const needsConversion =
    type.includes('tiff') || type.includes('webp') || type.includes('gif') ||
    ['.tiff', '.tif', '.webp', '.gif'].some(e => name.endsWith(e))

  let imgBuffer = buffer
  if (needsConversion) {
    const sharp = (await import('sharp')).default
    imgBuffer = await sharp(buffer).png().toBuffer()
  }

  const isJpeg =
    (type.includes('jpeg') || type.includes('jpg') || name.endsWith('.jpg') || name.endsWith('.jpeg')) &&
    !needsConversion

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ autoFirstPage: false, margin: 0 })
    const chunks: Buffer[] = []
    doc.on('data', (c: Buffer) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    doc.addPage({ size: 'A4' })
    // pdfkit image() accepts a buffer; hint the type so it doesn't sniff incorrectly
    doc.image(imgBuffer, 0, 0, {
      fit: [595.28, 841.89],
      align: 'center',
      valign: 'center',
      ...(isJpeg ? {} : {}), // pdfkit auto-detects PNG/JPEG from buffer magic bytes
    })
    doc.end()
  })
}

function textToPdf(text: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 })
    const chunks: Buffer[] = []
    doc.on('data', (c: Buffer) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    doc.fontSize(9).font('Courier').text(text, { lineGap: 2, lineBreak: true })
    doc.end()
  })
}

function excelToPdf(buffer: Buffer): Promise<Buffer> {
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const lines: string[] = []

  for (const sheetName of workbook.SheetNames) {
    if (lines.length > 0) lines.push('')
    lines.push(`=== ${sheetName} ===`)
    const sheet = workbook.Sheets[sheetName]
    lines.push(XLSX.utils.sheet_to_csv(sheet))
  }

  return textToPdf(lines.join('\n'))
}
