import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { billId, glAccountId } = await request.json() as { billId: string; glAccountId: string }
  if (!billId || !glAccountId) return NextResponse.json({ error: 'Missing params' }, { status: 400 })

  const { error } = await supabase
    .from('bill_line_items')
    .update({ gl_account_id: glAccountId, gl_account_source: 'manual' })
    .eq('bill_id', billId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
