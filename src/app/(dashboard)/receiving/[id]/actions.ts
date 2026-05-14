'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

type LineReceiving = {
  line_id: string
  status: 'received' | 'partial' | 'not_received'
  quantity_received: number
  note: string
}

export async function submitReceiving({
  poId,
  lineItems,
  notes,
}: {
  poId: string
  lineItems: LineReceiving[]
  notes: string
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Update each line item's quantity_received
  await Promise.all(
    lineItems.map(line =>
      supabase
        .from('po_line_items')
        .update({ quantity_received: line.quantity_received })
        .eq('line_id', line.line_id)
    )
  )

  // Save receiving record
  const { data: po } = await supabase
    .from('purchase_orders')
    .select('company_id, po_line_items(quantity_ordered, quantity_received)')
    .eq('po_id', poId)
    .single()

  if (po) {
    await supabase.from('receiving_records').insert({
      po_id: poId,
      company_id: po.company_id,
      received_by: user?.id,
      notes: notes || null,
      line_items: lineItems,
    })

    // Update PO status based on all lines
    const lines = (po.po_line_items as { quantity_ordered: number; quantity_received: number }[]) ?? []
    const allReceived = lines.every(l => (l.quantity_received ?? 0) >= (l.quantity_ordered ?? 0))
    const anyReceived = lines.some(l => (l.quantity_received ?? 0) > 0)

    const newStatus = allReceived ? 'received' : anyReceived ? 'partially_received' : 'open'
    await supabase
      .from('purchase_orders')
      .update({ status: newStatus })
      .eq('po_id', poId)
  }

  revalidatePath('/receiving')
  revalidatePath('/purchase-orders')
}
