import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { syncAll } from '@/lib/quickbooks/sync'
import { tryMatchJob } from '@/lib/ocr/process'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: billId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: bill } = await supabase
    .from('bills')
    .select('bill_id, company_id, vendor_po_reference, status')
    .eq('bill_id', billId)
    .single()

  if (!bill) return NextResponse.json({ error: 'Bill not found' }, { status: 404 })
  if (bill.status !== 'pending_job_match') {
    return NextResponse.json({ error: 'Bill is not in pending_job_match status' }, { status: 400 })
  }

  // First sync jobs from QB to get latest
  try {
    await syncAll(bill.company_id)
  } catch { /* non-fatal */ }

  if (!bill.vendor_po_reference) {
    return NextResponse.json({ matched: false, reason: 'No PO reference on bill' })
  }

  const serviceClient = createServiceClient()
  const matched = await tryMatchJob(serviceClient, bill.bill_id, bill.company_id, bill.vendor_po_reference)

  return NextResponse.json({ matched })
}
