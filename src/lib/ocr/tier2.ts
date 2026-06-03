import Anthropic from '@anthropic-ai/sdk'
import type { TierResult } from './types'

// ---------------------------------------------------------------------------
// Tier 2: Claude Haiku — structured extraction from raw PDF text
// Cached system prompt (≥1024 tokens on Haiku) minimises cost on repeat calls
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are an invoice data extraction engine. You receive raw text extracted from a vendor invoice PDF and return structured JSON.

IMPORTANT: The text is extracted from a PDF by a parser that often concatenates table columns with no spaces. For example, a line item row may appear as "Copper pipe 10ft5$48.75$243.75" meaning description="Copper pipe 10ft", qty=5, unit_price=48.75, total=243.75. Parse accordingly — the qty is the number immediately before the first dollar sign, and the two dollar amounts that follow are unit price and line total.

Extract the following fields from the invoice text:
- vendor_name: The vendor/supplier company name
- invoice_number: The invoice or document number
- invoice_date: Invoice date in ISO 8601 format (YYYY-MM-DD). Convert from any input format.
- due_date: Payment due date in ISO 8601 format (YYYY-MM-DD). Null if not present.
- vendor_po_reference: The customer PO number, job number, reference number, or work order number that the vendor printed on the invoice. This is the contractor's own PO or job reference, not the vendor's order number.
- job_name: The value of any field explicitly labeled "Job", "Job Name", "Job #", "Project", or "Work Order Name" on the document. This is the job or project name/number as printed — distinct from the PO reference. Null if no such labeled field exists.
- total: The invoice total (numeric, no currency symbols or commas)
- subtotal: The subtotal before tax (numeric). Null if not present.
- tax_amount: Total tax charged (numeric). Null if not present.
- line_items: Array of line items, each with:
  - description: Item description (string)
  - quantity: Quantity (numeric or null)
  - unit_price: Unit price (numeric or null)
  - total: Line item total (numeric or null)

Rules:
- Return ONLY valid JSON matching this exact schema — no explanation, no markdown code fences.
- All numeric values must be plain numbers (e.g. 1234.56, not "$1,234.56").
- Dates must be YYYY-MM-DD strings.
- If a field cannot be found, use null.
- line_items must be an array (empty array [] if no line items found).
- Do NOT invent data — only extract what is explicitly on the invoice.
- vendor_po_reference is whatever PO/job/reference number the CUSTOMER gave the vendor, printed on this invoice.

Example output:
{
  "vendor_name": "Gensco, Inc.",
  "invoice_number": "INV-20240312",
  "invoice_date": "2024-03-12",
  "due_date": "2024-04-11",
  "vendor_po_reference": "JOB-1047",
  "total": 1234.56,
  "subtotal": 1100.00,
  "tax_amount": 134.56,
  "line_items": [
    { "description": "1/2 Copper Pipe 10ft", "quantity": 5, "unit_price": 45.00, "total": 225.00 },
    { "description": "Ball Valve 1/2\"", "quantity": 10, "unit_price": 8.75, "total": 87.50 }
  ]
}`

let _client: Anthropic | null = null
function getClient(): Anthropic {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  return _client
}

export async function extractTier2(rawText: string, userComment?: string, documentType: 'invoice' | 'po' = 'invoice'): Promise<TierResult> {
  const client = getClient()

  const docNote = documentType === 'po'
    ? 'IMPORTANT: This document is a Purchase Order (PO), not an invoice. Map "PO Number" or "Order Number" → invoice_number, "Order Date" → invoice_date, "Expected Delivery" or "Ship Date" → due_date, and extract all line items (item descriptions, quantities, unit prices). Even if line item totals are missing or do not add up to the order total, include every line item you can find.'
    : ''

  const userMessage = userComment
    ? `${docNote ? docNote + '\n\n' : ''}Extract data from this text.\n\nNote from reviewer: "${userComment}"\n\nText:\n\n${rawText}`
    : `${docNote ? docNote + '\n\n' : ''}Extract data from this text:\n\n${rawText}`

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      {
        role: 'user',
        content: userMessage,
      },
    ],
  })

  const content = response.content[0]
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude Haiku')
  }

  const parsed = parseJsonResponse(content.text)
  return toTierResult(parsed)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseJsonResponse(text: string): Record<string, unknown> {
  // Strip markdown code fences if model adds them despite instructions
  const cleaned = text.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    throw new Error(`Claude Haiku returned non-JSON: ${text.slice(0, 200)}`)
  }
}

function toTierResult(data: Record<string, unknown>): TierResult {
  const lineItems = Array.isArray(data.line_items)
    ? (data.line_items as Record<string, unknown>[]).map((item, i) => ({
        description: String(item.description ?? ''),
        quantity:    toNumber(item.quantity),
        unit_price:  toNumber(item.unit_price),
        total:       toNumber(item.total),
        sort_order:  i,
      }))
    : []

  const hasRequired =
    data.invoice_number != null &&
    data.invoice_date != null &&
    data.total != null

  return {
    vendor_name_raw:      toString(data.vendor_name),
    invoice_number:       toString(data.invoice_number),
    invoice_date:         toString(data.invoice_date),
    due_date:             toString(data.due_date),
    vendor_po_reference:  toString(data.vendor_po_reference),
    job_name_extracted:   toString(data.job_name),
    total:                toNumber(data.total),
    subtotal:             toNumber(data.subtotal),
    tax_amount:           toNumber(data.tax_amount),
    line_items:           lineItems,
    confidence:           hasRequired ? 0.9 : 0.6,
  }
}

function toString(v: unknown): string | null {
  if (v == null) return null
  const s = String(v).trim()
  return s === '' || s === 'null' ? null : s
}

function toNumber(v: unknown): number | null {
  if (v == null) return null
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[,$]/g, ''))
  return isNaN(n) ? null : n
}
