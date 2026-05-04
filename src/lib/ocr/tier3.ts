import Anthropic from '@anthropic-ai/sdk'
import type { TierResult } from './types'

// ---------------------------------------------------------------------------
// Tier 3: Claude Opus 4.7 — vision/document extraction from raw PDF bytes
// Used when no text layer is detected (scanned / image-based PDFs)
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are an invoice data extraction engine. You receive a PDF invoice (possibly scanned or image-based) and return structured JSON.

Extract the following fields:
- vendor_name: The vendor/supplier company name
- invoice_number: The invoice or document number
- invoice_date: Invoice date in ISO 8601 format (YYYY-MM-DD)
- due_date: Payment due date in ISO 8601 format (YYYY-MM-DD). Null if not present.
- vendor_po_reference: The customer's PO number, job number, or reference number that the vendor printed on the invoice.
- total: The invoice total (numeric only)
- subtotal: The subtotal before tax (numeric). Null if not present.
- tax_amount: Total tax charged (numeric). Null if not present.
- line_items: Array of line items, each with:
  - description: Item description
  - quantity: Quantity (numeric or null)
  - unit_price: Unit price (numeric or null)
  - total: Line item total (numeric or null)

Rules:
- Return ONLY valid JSON — no explanation, no markdown fences.
- All numeric values must be plain numbers (e.g. 1234.56).
- Dates must be YYYY-MM-DD strings.
- Null for any field that cannot be read clearly.
- line_items is [] if no line items are visible.
- Do NOT hallucinate data — only extract what you can actually see.

Example output:
{
  "vendor_name": "ABC Supply Co.",
  "invoice_number": "2024-00891",
  "invoice_date": "2024-03-15",
  "due_date": "2024-04-14",
  "vendor_po_reference": "1047",
  "total": 892.44,
  "subtotal": 820.00,
  "tax_amount": 72.44,
  "line_items": [
    { "description": "Filter Drier 3/4\"", "quantity": 4, "unit_price": 18.50, "total": 74.00 }
  ]
}`

let _client: Anthropic | null = null
function getClient(): Anthropic {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  return _client
}

export async function extractTier3(pdfBuffer: Buffer): Promise<TierResult> {
  const client = getClient()
  const base64Pdf = pdfBuffer.toString('base64')

  const response = await client.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 4096,
    thinking: { type: 'adaptive' },
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
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: base64Pdf,
            },
          } as Anthropic.DocumentBlockParam,
          {
            type: 'text',
            text: 'Extract all invoice data from this PDF and return the JSON.',
          },
        ],
      },
    ],
  })

  // Find the text block (thinking blocks come first when adaptive thinking fires)
  const textBlock = response.content.find((b) => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text block in Claude Opus response')
  }

  const parsed = parseJsonResponse(textBlock.text)
  return toTierResult(parsed)
}

// ---------------------------------------------------------------------------
// Helpers (same pattern as tier2)
// ---------------------------------------------------------------------------

function parseJsonResponse(text: string): Record<string, unknown> {
  const cleaned = text.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    throw new Error(`Claude Opus returned non-JSON: ${text.slice(0, 200)}`)
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
    total:                toNumber(data.total),
    subtotal:             toNumber(data.subtotal),
    tax_amount:           toNumber(data.tax_amount),
    line_items:           lineItems,
    confidence:           hasRequired ? 0.95 : 0.7,
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
