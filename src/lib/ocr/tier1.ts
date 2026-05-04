// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>
import type { TierResult, LineItem } from './types'

// ---------------------------------------------------------------------------
// Tier 1: pdf-parse text extraction + regex field matching
// ---------------------------------------------------------------------------

export async function extractTier1(pdfBuffer: Buffer): Promise<TierResult & { rawText: string }> {
  const data = await pdfParse(pdfBuffer)
  const text = data.text ?? ''

  const vendor_name_raw    = extractVendorName(text)
  const invoice_number     = extractInvoiceNumber(text)
  const invoice_date       = extractInvoiceDate(text)
  const due_date           = extractDueDate(text)
  const vendor_po_reference = extractPONumber(text)
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
  const patterns = [
    /invoice\s*(?:#|no\.?|number)?\s*[:–-]?\s*([A-Z0-9\-]+)/i,
    /inv\s*(?:#|no\.?)?\s*[:–-]?\s*([A-Z0-9\-]+)/i,
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
    /(?:purchase\s+order|p\.?o\.?)\s*(?:#|no\.?|number)?\s*[:–-]?\s*([A-Z0-9\-]+)/i,
    /(?:your\s+)?(?:ref|reference|job)\s*(?:#|no\.?)?\s*[:–-]?\s*([A-Z0-9\-]+)/i,
    /customer\s+po\s*[:–-]?\s*([A-Z0-9\-]+)/i,
  ]
  return firstMatch(text, patterns)
}

function extractTotal(text: string): number | null {
  const patterns = [
    /(?:invoice\s+)?total(?:\s+due)?\s*[:–-]?\s*\$?\s*([\d,]+\.?\d*)/i,
    /amount\s+due\s*[:–-]?\s*\$?\s*([\d,]+\.?\d*)/i,
    /total\s+amount\s*[:–-]?\s*\$?\s*([\d,]+\.?\d*)/i,
    /balance\s+due\s*[:–-]?\s*\$?\s*([\d,]+\.?\d*)/i,
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
    /(?:sales\s+)?tax\s*[:–-]?\s*\$?\s*([\d,]+\.?\d*)/i,
    /gst\s*[:–-]?\s*\$?\s*([\d,]+\.?\d*)/i,
    /hst\s*[:–-]?\s*\$?\s*([\d,]+\.?\d*)/i,
    /vat\s*[:–-]?\s*\$?\s*([\d,]+\.?\d*)/i,
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

function extractLineItems(text: string): LineItem[] {
  // Best-effort: look for lines that have a dollar amount at the end
  const lineItemRe = /^(.+?)\s+(\d+(?:\.\d+)?)\s+\$?([\d,]+\.\d{2})\s+\$?([\d,]+\.\d{2})\s*$/gm
  const simpleRe   = /^(.+?)\s+\$?([\d,]+\.\d{2})\s*$/gm

  const items: LineItem[] = []

  let match: RegExpExecArray | null
  while ((match = lineItemRe.exec(text)) !== null) {
    items.push({
      description: match[1].trim(),
      quantity:    parseFloat(match[2]),
      unit_price:  parseAmount(match[3]),
      total:       parseAmount(match[4]),
      sort_order:  items.length,
    })
  }

  if (items.length === 0) {
    while ((match = simpleRe.exec(text)) !== null) {
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
  return /^(sub\s*total|total|tax|shipping|freight|discount|amount due|balance due)/i.test(desc)
}
