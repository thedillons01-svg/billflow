import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { processBill } from '@/lib/ocr/process'

// One-shot admin endpoint: reprocesses specific bills at Tier 1 without forcing
// Tier 2/3 escalation (and without charging credits). Used to fix bulk bad extractions.
// Restricted to admin email only.

const ADMIN_EMAIL = 'thedillons01@gmail.com'

export async function POST(req: NextRequest) {
  const { email, billIds } = await req.json() as { email?: string; billIds?: string[] }

  if (email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (!Array.isArray(billIds) || billIds.length === 0) {
    return NextResponse.json({ error: 'billIds required' }, { status: 400 })
  }

  const service = createServiceClient()
  const results: { billId: string; ok: boolean; error?: string }[] = []

  for (const billId of billIds) {
    try {
      // Reset to draft so processBill can run cleanly
      await service.from('bills').update({ status: 'draft', reprocess_count: 0 }).eq('bill_id', billId)
      // Delete stale line items
      await service.from('bill_line_items').delete().eq('bill_id', billId)
      // Run at Tier 1 (no forceTier = starts from top)
      await processBill(billId, { skipCredits: true })
      results.push({ billId, ok: true })
    } catch (err) {
      results.push({ billId, ok: false, error: err instanceof Error ? err.message : String(err) })
    }
  }

  return NextResponse.json({ results })
}
