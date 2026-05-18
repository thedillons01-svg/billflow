import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { tryMatchJob } from '@/lib/ocr/process'

// Retry job matching for pending_job_match bills.
// Runs every 2 hours during business hours (7am–7pm) — configured in vercel.json.
export async function GET(req: NextRequest) {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '')
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Only run during business hours (7am–7pm UTC — adjust if needed)
  const hour = new Date().getUTCHours()
  if (hour < 7 || hour >= 19) {
    return NextResponse.json({ skipped: true, reason: 'outside_business_hours' })
  }

  const supabase = createServiceClient()

  const { data: pendingBills } = await supabase
    .from('bills')
    .select('bill_id, company_id, vendor_po_reference')
    .eq('status', 'pending_job_match')
    .is('deleted_at', null)

  if (!pendingBills || pendingBills.length === 0) {
    return NextResponse.json({ matched: 0, still_pending: 0 })
  }

  let matched = 0
  let stillPending = 0

  for (const bill of pendingBills) {
    if (!bill.vendor_po_reference) {
      stillPending++
      continue
    }
    const found = await tryMatchJob(supabase, bill.bill_id, bill.company_id, bill.vendor_po_reference)
    if (found) matched++
    else stillPending++
  }

  return NextResponse.json({ matched, still_pending: stillPending })
}
