import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { syncAll } from '@/lib/quickbooks/sync'

export async function POST() {
  const supabase = await createClient()
  const { data: company } = await supabase
    .from('companies')
    .select('company_id, qb_connection_status')
    .single()

  if (!company) return NextResponse.json({ error: 'No company found' }, { status: 404 })
  if (company.qb_connection_status !== 'connected') {
    return NextResponse.json({ error: 'QuickBooks not connected' }, { status: 400 })
  }

  try {
    await syncAll(company.company_id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('QB sync error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
