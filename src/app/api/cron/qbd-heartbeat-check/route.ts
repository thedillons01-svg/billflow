import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendNotification } from '@/lib/notifications/send-email'

// Mark QBD heartbeats as overdue/alert if not seen recently, send notifications on state change
export async function GET(req: NextRequest) {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '')
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const now = new Date()
  const overdueThreshold = new Date(now.getTime() - 60 * 60 * 1000)   // 1 hour
  const alertThreshold   = new Date(now.getTime() - 4 * 60 * 60 * 1000) // 4 hours

  // Find heartbeats that are about to transition to overdue
  const { data: goingOverdue } = await supabase.from('qbd_heartbeats')
    .select('company_id')
    .eq('connector_status', 'running')
    .lt('last_heartbeat_at', overdueThreshold.toISOString())

  // Find heartbeats that are about to transition to alert
  const { data: goingAlert } = await supabase.from('qbd_heartbeats')
    .select('company_id')
    .in('connector_status', ['running', 'overdue'])
    .lt('last_heartbeat_at', alertThreshold.toISOString())

  // Apply status updates
  await supabase.from('qbd_heartbeats')
    .update({ connector_status: 'overdue' })
    .eq('connector_status', 'running')
    .lt('last_heartbeat_at', overdueThreshold.toISOString())

  await supabase.from('qbd_heartbeats')
    .update({ connector_status: 'alert' })
    .in('connector_status', ['running', 'overdue'])
    .lt('last_heartbeat_at', alertThreshold.toISOString())

  // Send notifications for transitions (but not duplicate alerts)
  const alertedCompanies = new Set((goingAlert ?? []).map(h => h.company_id))

  for (const { company_id } of (goingOverdue ?? [])) {
    // Skip if this company is also going to alert — will get the alert notification
    if (alertedCompanies.has(company_id)) continue
    await sendNotification({
      companyId: company_id,
      event:     'qb_heartbeat_lost',
      subject:   'QuickBooks Desktop connection overdue',
      body:      'The QuickBooks Desktop Web Connector has not polled in over an hour. Check that QuickBooks is open and the Web Connector is running.',
    })
  }

  for (const { company_id } of (goingAlert ?? [])) {
    await sendNotification({
      companyId: company_id,
      event:     'qb_heartbeat_lost',
      subject:   'QuickBooks Desktop connection lost',
      body:      'The QuickBooks Desktop Web Connector has not polled in over 4 hours. Bills queued for sync will not push until the connection is restored.',
    })
  }

  return NextResponse.json({
    ok: true,
    going_overdue: (goingOverdue ?? []).length,
    going_alert:   (goingAlert ?? []).length,
  })
}
