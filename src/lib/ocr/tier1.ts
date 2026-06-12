// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>
import type { TierResult, LineItem } from './types'

// ---------------------------------------------------------------------------
// Tier 1: pdf-parse text extraction + regex field matching
// ---------------------------------------------------------------------------

export async function extractTier1(pdfBuffer: Buffer): Promise<TierResult & { rawText: string; pdfParseError?: string }> {
  let text: string
  let pdfParseError: string | undefined
  try {
    const data = await pdfParse(pdfBuffer)
    text = data.text ?? ''
  } catch (err) {
    pdfParseError = err instanceof Error ? err.message : String(err)
    console.warn(`[ocr] Tier 1 pdf-parse failed: ${pdfParseError} — routing to Tier 3`)
    return {
      vendor_name_raw: null, invoice_number: null, invoice_date: null, due_date: null,
      vendor_po_reference: null, job_name_extracted: null, customer_name_extracted: null, total: null, subtotal: null, tax_amount: null,
      line_items: [], confidence: 0, raw_text: '', rawText: '', pdfParseError,
    }
  }

  const vendor_name_raw    = extractVendorName(text)
  const invoice_number     = extractInvoiceNumber(text)
  const invoice_date       = extractInvoiceDate(text)
  const due_date           = extractDueDate(text)
  const vendor_po_reference     = extractPONumber(text)
  const job_name_extracted      = extractJobName(text)
  const customer_name_extracted = extractCustomerName(text)
  const total              = extractTotal(text)
  const subtotal           = extractSubtotal(text)
  const tax_amount         = extractTax(text)
  const line_items         = extractLineItems(text)

  const requiredFound =
    invoice_number !== null && invoice_date !== null && total !== null

  const confidence = requiredFound ? 0.85 : 0.3

  return {
    vendor_name_raw,
    invoice_number,
    invoice_date,
    due_date,
    vendor_po_reference,
    job_name_extracted,
    customer_name_extracted,
    total,
    subtotal,
    tax_amount,
    line_items,
    confidence,
    raw_text: text,
    rawText: text,
  }
}

export function hasTextLayer(text: string): boolean {
  return text.trim().length >= 50
}

// ---------------------------------------------------------------------------
// Field extractors
// ---------------------------------------------------------------------------

function extractInvoiceNumber(text: string): string | null {
  // Require an explicit delimiter (#, no., number, or :) so we don't pick up
  // address numbers that appear after a bare "INVOICE" heading.
  const patterns = [
    /invoice\s*(?:#|no\.?|number)\s*[:–-]?\s*([A-Z0-9][A-Z0-9\-]{2,})/i,
    /invoice\s*[:–]\s*([A-Z0-9][A-Z0-9\-]{2,})/i,
    /inv\s*(?:#|no\.?)\s*[:–-]?\s*([A-Z0-9][A-Z0-9\-]{2,})/i,
    // Label-on-own-line: PDFKit labelValue helper renders label and value as separate
    // text objects ~11pt apart; pdf-parse splits them onto separate lines.
    /invoice\s*(?:#|no\.?|number)\s*[:–-]?\s*\r?\n\s*([A-Z0-9][A-Z0-9\-]{2,})/i,
    /(?:^|\n)\s*#\s*([A-Z0-9\-]{4,20})/m,
  ]
  return firstMatch(text, patterns)
}

function extractInvoiceDate(text: string): string | null {
  const patterns = [
    /invoice\s+date\s*[:–-]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
    /date\s+of\s+invoice\s*[:–-]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
    /(?:date|dated)\s*[:–-]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
    /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})/,
    /(\w+ \d{1,2},?\s*\d{4})/,
  ]
  const raw = firstMatch(text, patterns)
  return raw ? normalizeDate(raw) : null
}

function extractDueDate(text: string): string | null {
  const patterns = [
    /due\s+date\s*[:–-]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
    /payment\s+due\s*[:–-]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
    /pay\s+by\s*[:–-]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
  ]
  const raw = firstMatch(text, patterns)
  return raw ? normalizeDate(raw) : null
}

function extractPONumber(text: string): string | null {
  const patterns = [
    // (?=[^A-Za-z]) prevents "p\.?o\.?" from matching the "Po" inside city names like "Portland"
    /(?:purchase\s+order|p\.?o\.?)(?=[^A-Za-z])\s*(?:#|no\.?|number)?\s*[:–-]?\s*([A-Z0-9\-]+)/i,
    /(?:your\s+)?(?:ref|reference|job)\s*(?:#|no\.?)?\s*[:–-]?\s*([A-Z0-9\-]+)/i,
    /customer\s+po\s*[:–-]?\s*([A-Z0-9\-]+)/i,
  ]
  return firstMatch(text, patterns)
}

function extractJobName(text: string): string | null {
  const patterns = [
    /(?:job\s+name|job\s+title)\s*[:–-]\s*(.+?)(?:\n|$)/i,
    /\bjob\s*(?:#|no\.?|number)?\s*[:–-]\s*(.+?)(?:\n|$)/i,
    /\bproject\s*(?:name|#|no\.?)?\s*[:–-]\s*(.+?)(?:\n|$)/i,
    /\bwork\s+order\s*(?:name\s*)?[:–-]\s*(.+?)(?:\n|$)/i,
    /\bsite\s*[:–-]\s*(.+?)(?:\n|$)/i,
    /\blocation\s*[:–-]\s*(.+?)(?:\n|$)/i,
    // Label-on-own-line format: vendor PDF renders label and value as separate text
    // objects (e.g. PDFKit labelValue helper). "Job\n1052 — Riverside Apartments"
    /\bjob\b[ \t]*\r?\n[ \t]*(.+?)(?:\r?\n|$)/i,
    /\bproject\b[ \t]*\r?\n[ \t]*(.+?)(?:\r?\n|$)/i,
  ]
  const val = firstMatch(text, patterns)
  return val ? val.trim().slice(0, 100) : null
}

function extractCustomerName(text: string): string | null {
  // Only match fields explicitly labeled "Customer" or "Customer Name".
  // "Sold To" / "Bill To" / "Ship To" are intentionally excluded — those fields
  // contain the contractor's own address, not the end customer.
  const patterns = [
    /\bcustomer\s+name\s*[:–]\s*(.+?)(?:\n|$)/i,            // Customer Name: Smith
    /\bcustomer\s*[:–]\s*(.+?)(?:\n|$)/i,                    // Customer: Smith
    /\bcustomer\s+name\b[ \t]*\r?\n[ \t]*(.+?)(?:\r?\n|$)/i, // Customer Name\nSmith (label on own line)
    /\bcustomer\b[ \t]*\r?\n[ \t]*(.+?)(?:\r?\n|$)/i,        // Customer\nSmith (label on own line)
  ]
  const val = firstMatch(text, patterns)
  if (!val) return null
  const cleaned = val.trim().slice(0, 100)
  if (cleaned.length < 2 || /^\d/.test(cleaned)) return null
  return cleaned
}

function extractTotal(text: string): number | null {
  const patterns = [
    // "Invoice Total" explicitly — must come before bare "total" to avoid matching "Subtotal"
    /invoice\s+total\s*[:–-]?\s*\$?\s*([\d,]+\.?\d*)/i,
    /amount\s+due\s*[:–-]?\s*\$?\s*([\d,]+\.?\d*)/i,
    /total\s+amount\s*[:–-]?\s*\$?\s*([\d,]+\.?\d*)/i,
    /balance\s+due\s*[:–-]?\s*\$?\s*([\d,]+\.?\d*)/i,
    // Word-boundary "Total" — \b prevents matching inside "Subtotal"
    /\btotal(?:\s+due)?\s*[:–-]?\s*\$?\s*([\d,]+\.?\d*)/i,
  ]
  const raw = firstMatch(text, patterns)
  return raw ? parseAmount(raw) : null
}

function extractSubtotal(text: string): number | null {
  const patterns = [
    /sub\s*total\s*[:–-]?\s*\$?\s*([\d,]+\.?\d*)/i,
    /subtotal\s*[:–-]?\s*\$?\s*([\d,]+\.?\d*)/i,
    /merchandise\s+total\s*[:–-]?\s*\$?\s*([\d,]+\.?\d*)/i,
  ]
  const raw = firstMatch(text, patterns)
  return raw ? parseAmount(raw) : null
}

function extractTax(text: string): number | null {
  const patterns = [
    // Handles "Tax (8.5%) $495.59" — optional rate in parens between label and amount
    /(?:sales\s+)?tax(?:\s*\([^)]*\))?\s*[:–-]?\s*\$?\s*([\d,]+\.?\d*)/i,
    /gst(?:\s*\([^)]*\))?\s*[:–-]?\s*\$?\s*([\d,]+\.?\d*)/i,
    /hst(?:\s*\([^)]*\))?\s*[:–-]?\s*\$?\s*([\d,]+\.?\d*)/i,
    /vat(?:\s*\([^)]*\))?\s*[:–-]?\s*\$?\s*([\d,]+\.?\d*)/i,
  ]
  const raw = firstMatch(text, patterns)
  return raw ? parseAmount(raw) : null
}

function extractVendorName(text: string): string | null {
  // First non-empty line is usually the vendor name on a digital invoice
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  const first = lines[0] ?? null
  // Reject lines that look like dates, invoice numbers, or "Invoice"
  if (first && !/^invoice$/i.test(first) && !/^\d/.test(first) && first.length > 2) {
    return first
  }
  return null
}

// pdf-parse collapses table column whitespace even on visually-spaced PDFs.
// Normalise before matching: insert a space between a non-digit and the
// quantity digit(s) that precede $, and between adjacent dollar amounts.
function normalizeLineItemText(text: string): string {
  return text
    .replace(/([^\d$.\s])(\d+(?:\.\d+)?)\s*\$/g, '$1 $2 $')  // description/qty boundary — exclude . to avoid breaking decimal prices
    .replace(/([\d,]+\.\d{2})\$/g, '$1 $')                    // unit_price/total boundary
}

function extractLineItems(text: string): LineItem[] {
  const normalized = normalizeLineItemText(text)

  const lineItemRe = /^(.+?)\s+(\d+(?:\.\d+)?)\s+\$([\d,]+\.\d{2})\s+\$([\d,]+\.\d{2})\s*$/gm
  const simpleRe   = /^(.+?)\s+\$([\d,]+\.\d{2})\s*$/gm

  const items: LineItem[] = []

  let match: RegExpExecArray | null
  while ((match = lineItemRe.exec(normalized)) !== null) {
    items.push({
      description: match[1].trim(),
      quantity:    parseFloat(match[2]),
      unit_price:  parseAmount(match[3]),
      total:       parseAmount(match[4]),
      sort_order:  items.length,
    })
  }

  if (items.length === 0) {
    while ((match = simpleRe.exec(normalized)) !== null) {
      const desc = match[1].trim()
      if (isSummaryLine(desc)) continue
      items.push({
        description: desc,
        quantity:    null,
        unit_price:  null,
        total:       parseAmount(match[2]),
        sort_order:  items.length,
      })
    }
  }

  return items
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function firstMatch(text: string, patterns: RegExp[]): string | null {
  for (const re of patterns) {
    const m = re.exec(text)
    if (m?.[1]) return m[1].trim()
  }
  return null
}

function parseAmount(s: string): number | null {
  const n = parseFloat(s.replace(/,/g, ''))
  return isNaN(n) ? null : n
}

function normalizeDate(raw: string): string | null {
  const cleaned = raw.trim()

  // MM/DD/YYYY, MM-DD-YYYY, MM.DD.YYYY
  const slashDash = /^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/
  const m1 = slashDash.exec(cleaned)
  if (m1) {
    const [, mm, dd, yy] = m1
    const year = parseInt(yy.length === 2 ? `20${yy}` : yy, 10)
    if (year < 2000 || year > 2099) return null
    const month = parseInt(mm, 10)
    const day   = parseInt(dd, 10)
    if (month < 1 || month > 12 || day < 1 || day > 31) return null
    return `${year}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
  }

  // "January 15, 2024" or "Jan 15 2024"
  const monthName = /^([A-Za-z]+)\s+(\d{1,2}),?\s*(\d{4})$/
  const m2 = monthName.exec(cleaned)
  if (m2) {
    const d = new Date(`${m2[1]} ${m2[2]} ${m2[3]}`)
    const year = d.getFullYear()
    if (!isNaN(d.getTime()) && year >= 2000 && year <= 2099) {
      return d.toISOString().slice(0, 10)
    }
  }

  return null
}

function isSummaryLine(desc: string): boolean {
  return /^(sub\s*total|total|amount due|balance due)/i.test(desc)
}
