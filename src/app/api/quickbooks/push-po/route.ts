import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { pushPOToQBO } from '@/lib/quickbooks/push-po'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { poId } = await req.json()
  if (!poId) return NextResponse.json({ error: 'poId required' }, { status: 400 })

  const { data: company } = await supabase
    .from('companies')
    .select('company_id, qb_connection_status, push_pos_to_qb')
    .single()

  if (!company) return NextResponse.json({ error: 'No company found' }, { status: 404 })
  if (company.push_pos_to_qb === false) {
    return NextResponse.json({ error: 'QuickBooks PO push is disabled in Settings' }, { status: 400 })
  }
  if (company.qb_connection_status !== 'connected') {
    return NextResponse.json({ error: 'QuickBooks is not connected' }, { status: 400 })
  }

  const { data: po } = await supabase
    .from('purchase_orders')
    .select('po_id, status')
    .eq('po_id', poId)
    .eq('company_id', company.company_id)
    .single()

  if (!po) return NextResponse.json({ error: 'PO not found' }, { status: 404 })

  try {
    await pushPOToQBO(poId, company.company_id)
    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Push failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
