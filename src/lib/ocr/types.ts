export type LineItem = {
  description: string
  quantity: number | null
  unit_price: number | null
  total: number | null
  gl_account_hint?: string
  sort_order: number
}

export type ExtractionResult = {
  vendor_name_raw: string | null
  invoice_number: string | null
  invoice_date: string | null    // ISO 8601 date string YYYY-MM-DD
  due_date: string | null        // ISO 8601 date string YYYY-MM-DD
  vendor_po_reference: string | null
  total: number | null
  subtotal: number | null
  tax_amount: number | null
  line_items: LineItem[]
  tier: 1 | 2 | 3
  confidence: number             // 0.0–1.0
  raw_text?: string              // Tier 1/2: extracted text (not stored in DB, used for fallback)
}

export type TierResult = Omit<ExtractionResult, 'tier'>
