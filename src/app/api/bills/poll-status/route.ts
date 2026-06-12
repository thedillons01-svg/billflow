import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const ids = request.nextUrl.searchParams.get('ids')?.split(',').filter(Boolean) ?? []
  if (ids.length === 0) return NextResponse.json({ statuses: {} })

  const supabase = await createClient()
  const { data } = await supabase
    .from('bills')
    .select('bill_id, status')
    .in('bill_id', ids)

  const statuses: Record<string, string> = {}
  for (const row of data ?? []) {
    statuses[row.bill_id] = row.status
  }
  return NextResponse.json({ statuses })
}
