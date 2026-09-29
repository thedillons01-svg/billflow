import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendDailyDigestForCompany } from '@/lib/notifications/daily-digest'

export async function GET(req: NextRequest) {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '')
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  const { data: companies } = await supabase
    .from('companies')
    .select('company_id')
    .eq('daily_digest', true)

  if (!companies || companies.length === 0) {
    return NextResponse.json({ message: 'No companies with daily digest on', results: [] })
  }

  const results = []
  for (const { company_id } of companies) {
    try {
      const sent = await sendDailyDigestForCompany(company_id)
      results.push({ company_id, sent })
    } catch (err) {
      results.push({ company_id, error: err instanceof Error ? err.message : String(err) })
    }
  }

  return NextResponse.json({ results })
}
