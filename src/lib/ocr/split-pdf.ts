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
 *
 * IMPORTANT: never call pdfParse with a `pagerender` callback here.
 * pdf-parse v1 stores the callback in a module-level variable that persists
 * across invocations in the same warm serverless function instance. Any
 * subsequent pdfParse call (e.g. from extractTier1) then runs through that
 * callback and returns empty text, causing all following bills to fall through
 * to Tier 3 vision extraction for the lifetime of that instance.
 */
export async function splitPdf(pdfBytes: Buffer): Promise<Buffer[]> {
  const srcDoc = await PDFDocument.load(pdfBytes)
  const pageCount = srcDoc.getPageCount()

  if (pageCount <= 1) return [pdfBytes]

  // Multi-page bundle: extract each page as its own single-page PDF with pdf-lib,
  // then run plain pdfParse (no pagerender callback) on each to detect summary pages.
  const pageBuffers: Buffer[] = []
  for (let i = 0; i < pageCount; i++) {
    const singleDoc = await PDFDocument.create()
    const [copiedPage] = await singleDoc.copyPages(srcDoc, [i])
    singleDoc.addPage(copiedPage)
    pageBuffers.push(Buffer.from(await singleDoc.save()))
  }

  const summaryPageIndices = new Set<number>()
  for (let i = 0; i < pageBuffers.length; i++) {
    try {
      const data = await pdfParse(pageBuffers[i])
      const text = (data.text ?? '').toLowerCase()
      if (SUMMARY_KEYWORDS.some(kw => text.includes(kw))) {
        summaryPageIndices.add(i)
      }
    } catch {
      // Can't read text from this page — don't discard it, let OCR decide
    }
  }

  // No summary pages → single document, not a bundle
  if (summaryPageIndices.size === 0) return [pdfBytes]

  const results = pageBuffers.filter((_, i) => !summaryPageIndices.has(i))
  return results.length > 0 ? results : [pdfBytes]
}
