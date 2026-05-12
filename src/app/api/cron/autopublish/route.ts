import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { runAutopublishForCompany } from '@/lib/autopublish/engine'

export async function GET(req: NextRequest) {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '')
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  // Get all companies with QB connected (use service role would be ideal,
  // but with placeholder RLS this works)
  const { data: companies } = await supabase
    .from('companies')
    .select('company_id')
    .eq('qb_connection_status', 'connected')

  if (!companies || companies.length === 0) {
    return NextResponse.json({ message: 'No connected companies', results: [] })
  }

  const results = []
  for (const { company_id } of companies) {
    try {
      const stats = await runAutopublishForCompany(company_id)
      results.push({ company_id, ...stats })
    } catch (err) {
      results.push({ company_id, error: err instanceof Error ? err.message : String(err) })
    }
  }

  return NextResponse.json({ results })
}
