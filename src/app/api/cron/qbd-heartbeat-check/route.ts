import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

// Mark QBD heartbeats as overdue/alert if not seen recently
export async function GET(req: NextRequest) {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '')
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const now = new Date()
  const overdueThreshold = new Date(now.getTime() - 60 * 60 * 1000)  // 1 hour
  const alertThreshold = new Date(now.getTime() - 4 * 60 * 60 * 1000) // 4 hours

  // Mark overdue
  await supabase.from('qbd_heartbeats')
    .update({ connector_status: 'overdue' })
    .eq('connector_status', 'running')
    .lt('last_heartbeat_at', overdueThreshold.toISOString())

  // Mark alert
  await supabase.from('qbd_heartbeats')
    .update({ connector_status: 'alert' })
    .in('connector_status', ['running', 'overdue'])
    .lt('last_heartbeat_at', alertThreshold.toISOString())

  return NextResponse.json({ ok: true })
}
