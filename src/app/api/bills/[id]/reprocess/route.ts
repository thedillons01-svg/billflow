import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { processBill } from '@/lib/ocr/process'

export const maxDuration = 60

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: billId } = await params

  // Auth — verify caller has access to this bill
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: bill } = await supabase
    .from('bills')
    .select('bill_id, status, company_id')
    .eq('bill_id', billId)
    .is('deleted_at', null)
    .single()

  if (!bill) return NextResponse.json({ error: 'Bill not found' }, { status: 404 })
  if (!['ocr_error', 'draft'].includes(bill.status)) {
    return NextResponse.json({ error: 'Only ocr_error or draft bills can be reprocessed' }, { status: 400 })
  }

  // Reset to draft with service client so processBill sees draft status
  const service = createServiceClient()
  await service
    .from('bills')
    .update({ status: 'draft', autopublish_hold_reason: null })
    .eq('bill_id', billId)

  try {
    await processBill(billId, { skipCredits: true })
  } catch (err) {
    return NextResponse.json(
      { error: `Reprocess failed: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true })
}
