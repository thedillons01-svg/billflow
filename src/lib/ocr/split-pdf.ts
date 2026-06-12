import pdfParse from 'pdf-parse'
import { PDFDocument } from 'pdf-lib'

// Pages containing these keywords are treated as summary/statement pages and discarded.
const SUMMARY_KEYWORDS = ['statement', 'remittance advice', 'invoice summary', 'account summary']

/**
 * Splits a multi-invoice PDF bundle into individual per-invoice buffers.
 *
 * Handles the Gensco pattern: a PDF where the first page is a statement/summary
 * and the remaining pages are individual invoices. Summary pages are discarded;
 * each remaining page becomes its own single-page PDF.
 *
 * Returns [original] unchanged when:
 *  - The PDF has only one page
 *  - No summary/statement pages are detected (treat as single document)
 */
export async function splitPdf(pdfBytes: Buffer): Promise<Buffer[]> {
  // Use pdf-lib for the page count check — avoids calling pdfParse here for
  // single-page PDFs. pdf-parse v1 stores state in module-level variables that
  // a pagerender callback dirties; a second pdfParse call in the same serverless
  // invocation (from extractTier1 via after()) then returns empty text and the
  // bill falls through to Tier 3 even when the PDF has a full text layer.
  const srcDoc = await PDFDocument.load(pdfBytes)
  const pageCount = srcDoc.getPageCount()

  if (pageCount <= 1) return [pdfBytes]

  // Multi-page bundle — use pdfParse to identify and discard summary/statement pages
  const pageTexts: string[] = []
  let pageIndex = 0
  await pdfParse(pdfBytes, {
    pagerender: async (pageData: any) => {
      const idx = pageIndex++
      try {
        const textContent = await pageData.getTextContent()
        const text = (textContent.items as Array<{ str: string }>)
          .map(item => item.str)
          .join(' ')
        pageTexts[idx] = text.toLowerCase()
        return text
      } catch {
        pageTexts[idx] = ''
        return ''
      }
    },
  })

  const summaryPageIndices = new Set(
    pageTexts.reduce<number[]>((acc, text, i) => {
      if (SUMMARY_KEYWORDS.some(kw => text.includes(kw))) acc.push(i)
      return acc
    }, [])
  )

  // No summary pages → single document, not a bundle
  if (summaryPageIndices.size === 0) return [pdfBytes]

  // srcDoc already loaded above (for the page count check) — reuse it here
  const results: Buffer[] = []

  for (let i = 0; i < pageCount; i++) {
    if (summaryPageIndices.has(i)) continue

    const singleDoc = await PDFDocument.create()
    const [copiedPage] = await singleDoc.copyPages(srcDoc, [i])
    singleDoc.addPage(copiedPage)
    const bytes = await singleDoc.save()
    results.push(Buffer.from(bytes))
  }

  return results.length > 0 ? results : [pdfBytes]
}
