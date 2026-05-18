import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { pushBillToQBO } from '@/lib/quickbooks/push'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { billId } = await req.json()
  if (!billId) return NextResponse.json({ error: 'billId required' }, { status: 400 })

  // Get company for this user
  const { data: company } = await supabase
    .from('companies')
    .select('company_id, qb_connection_status')
    .single()

  if (!company) return NextResponse.json({ error: 'No company found' }, { status: 404 })
  if (company.qb_connection_status !== 'connected') {
    return NextResponse.json({ error: 'QuickBooks is not connected' }, { status: 400 })
  }

  // Verify bill belongs to this company
  const { data: bill } = await supabase
    .from('bills')
    .select('bill_id, status')
    .eq('bill_id', billId)
    .eq('company_id', company.company_id)
    .single()

  if (!bill) return NextResponse.json({ error: 'Bill not found' }, { status: 404 })
  if (!['ready', 'sync_error'].includes(bill.status)) {
    return NextResponse.json({ error: `Cannot publish bill with status "${bill.status}"` }, { status: 400 })
  }

  // Mark as manual publish before calling push (autopublish sets 'auto' before calling)
  await supabase.from('bills')
    .update({ publish_method: 'manual' })
    .eq('bill_id', billId)

  try {
    await pushBillToQBO(billId, company.company_id)
    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Push failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
