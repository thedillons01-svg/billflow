import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { tryMatchJob } from '@/lib/ocr/process'
import { sendNotification } from '@/lib/notifications/send-email'

// Retry job matching for pending_job_match bills.
// Runs every 2 hours during business hours (7am–7pm) — configured in vercel.json.
// After 48 hours with no match, sends job_match_failed notification.
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
  const failedThreshold = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()

  const { data: pendingBills } = await supabase
    .from('bills')
    .select('bill_id, company_id, vendor_po_reference, created_at, vendor_name_raw, autopublish_hold_reason')
    .eq('status', 'pending_job_match')
    .is('deleted_at', null)

  if (!pendingBills || pendingBills.length === 0) {
    return NextResponse.json({ matched: 0, still_pending: 0, notified: 0 })
  }

  let matched = 0
  let stillPending = 0
  let notified = 0

  for (const bill of pendingBills) {
    if (!bill.vendor_po_reference) {
      stillPending++
      continue
    }
    const found = await tryMatchJob(supabase, bill.bill_id, bill.company_id, bill.vendor_po_reference)
    if (found) {
      matched++
      continue
    }
    stillPending++

    // After 48 hours still unmatched: send one-time job_match_failed notification
    const isOld = bill.created_at < failedThreshold
    const alreadyNotified = (bill.autopublish_hold_reason ?? '').includes('[match_failed_notified]')
    if (isOld && !alreadyNotified) {
      await supabase.from('bills')
        .update({ autopublish_hold_reason: `Job match failed — no QuickBooks job found for reference "${bill.vendor_po_reference}" after 48 hours of retries. Assign the job manually. [match_failed_notified]` })
        .eq('bill_id', bill.bill_id)
      await sendNotification({
        companyId: bill.company_id,
        event:     'job_match_failed',
        subject:   'Job match failed',
        body:      `No QuickBooks job was found for reference "${bill.vendor_po_reference}" on a bill from ${bill.vendor_name_raw ?? 'unknown vendor'} after 48 hours of retries. The bill is waiting in your inbox for manual job assignment.`,
        billId:    bill.bill_id,
      })
      notified++
    }
  }

  return NextResponse.json({ matched, still_pending: stillPending, notified })
}
