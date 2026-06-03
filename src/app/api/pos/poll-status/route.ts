import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Returns which PO IDs have completed OCR (po_number or vendor_name_raw updated from filename)
export async function GET(request: NextRequest) {
  const ids = request.nextUrl.searchParams.get('ids')?.split(',').filter(Boolean) ?? []
  if (ids.length === 0) return NextResponse.json({ ready: [] })

  const supabase = await createClient()
  const { data } = await supabase
    .from('purchase_orders')
    .select('po_id, po_number, order_date, vendor_name_raw')
    .in('po_id', ids)

  // A PO is "ready" once OCR has run — indicated by po_number or order_date being populated,
  // or vendor_name_raw being set to something other than null/empty
  const ready = (data ?? [])
    .filter(po => po.po_number != null || po.order_date != null)
    .map(po => po.po_id)

  return NextResponse.json({ ready })
}
