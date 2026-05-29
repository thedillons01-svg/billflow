import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { syncAll } from '@/lib/quickbooks/sync'

export async function GET(req: NextRequest) {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '')
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const { data: companies } = await supabase
    .from('companies')
    .select('company_id')
    .eq('qb_connection_status', 'connected')

  if (!companies || companies.length === 0) {
    return NextResponse.json({ message: 'No connected companies', synced: 0 })
  }

  const results = []
  for (const { company_id } of companies) {
    try {
      await syncAll(company_id)
      results.push({ company_id, ok: true })
    } catch (err) {
      results.push({ company_id, error: err instanceof Error ? err.message : String(err) })
    }
  }

  return NextResponse.json({ synced: results.filter(r => 'ok' in r).length, results })
}
