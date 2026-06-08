'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getQBClient } from '@/lib/quickbooks/client'

export async function updatePO(
  poId: string,
  fields: Partial<{
    vendor_id: string | null
    po_number: string | null
    order_date: string | null
    notes: string | null
  }>
) {
  const supabase = await createClient()
  await supabase.from('purchase_orders').update(fields).eq('po_id', poId)
  revalidatePath(`/purchase-orders/${poId}`)
}

export async function updatePOLineItem(
  lineId: string,
  poId: string,
  fields: Partial<{
    description: string | null
    quantity_ordered: number | null
    unit_cost: number | null
    extended_cost: number | null
    job_id: string | null
  }>
) {
  const supabase = await createClient()
  await supabase.from('po_line_items').update(fields).eq('line_id', lineId)
  revalidatePath(`/purchase-orders/${poId}`)
}

export async function applyJobToAllPOLines(poId: string, jobId: string | null) {
  const supabase = await createClient()
  await Promise.all([
    supabase.from('po_line_items').update({ job_id: jobId }).eq('po_id', poId),
    supabase.from('purchase_orders').update({ job_id: jobId }).eq('po_id', poId),
  ])
  revalidatePath(`/purchase-orders/${poId}`)
  revalidatePath('/purchase-orders')
}

export async function recalculatePOLineTotals(poId: string) {
  const supabase = await createClient()
  const { data: lines } = await supabase
    .from('po_line_items')
    .select('line_id, quantity_ordered, unit_cost')
    .eq('po_id', poId)
  if (!lines?.length) return
  for (const l of lines) {
    if (l.quantity_ordered != null && l.unit_cost != null) {
      const extended_cost = +((l.quantity_ordered * l.unit_cost).toFixed(2))
      await supabase.from('po_line_items').update({ extended_cost }).eq('line_id', l.line_id)
    }
  }
  revalidatePath(`/purchase-orders/${poId}`)
}

export async function closePO(poId: string) {
  const supabase = await createClient()
  await supabase
    .from('purchase_orders')
    .update({ status: 'closed' })
    .eq('po_id', poId)
  revalidatePath(`/purchase-orders/${poId}`)
}

export async function deletePO(poId: string) {
  const supabase = await createClient()
  await supabase
    .from('purchase_orders')
    .update({ deleted_at: new Date().toISOString() })
    .eq('po_id', poId)
  redirect('/purchase-orders')
}

export async function createVendorFromPO(
  poId: string,
  companyId: string,
  vendorNameExtracted: string
): Promise<{ vendorId: string } | { error: string }> {
  const supabase = await createClient()

  let qbVendorId: string
  let qbVendorName: string = vendorNameExtracted

  try {
    const { qbPost } = await getQBClient(companyId)
    try {
      const result = await qbPost('vendor', { DisplayName: vendorNameExtracted })
      qbVendorId = result.Vendor?.Id
      qbVendorName = result.Vendor?.DisplayName ?? vendorNameExtracted
      if (!qbVendorId) return { error: 'QuickBooks did not return a vendor ID' }
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      const dupMatch = msg.match(/"code":"6240"[\s\S]*?Id=(\d+)/)
      if (dupMatch) {
        qbVendorId = dupMatch[1]
      } else {
        throw e
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : ''
    return {
      error: msg.includes('not connected')
        ? 'QuickBooks is not connected. Connect QuickBooks in Settings before creating vendors.'
        : `Could not create vendor in QuickBooks: ${msg || 'unknown error'}`,
    }
  }

  const { data: vendor, error: vendorError } = await supabase
    .from('vendors')
    .insert({
      company_id: companyId,
      vendor_name_extracted: vendorNameExtracted,
      vendor_name_display: qbVendorName,
      qb_vendor_id: qbVendorId,
      qb_vendor_name: qbVendorName,
      is_visible: true,
      auto_publish_enabled: false,
      hold_for_job_match: false,
      invoices_processed: 0,
      gl_account_source: 'not_set',
      payment_terms_source: 'not_set',
      copy_po_to_qb_reference: true,
    })
    .select('vendor_id')
    .single()
  if (vendorError) return { error: vendorError.message }

  await supabase
    .from('purchase_orders')
    .update({ vendor_id: vendor.vendor_id })
    .eq('po_id', poId)

  await supabase.from('qb_vendors_cache').upsert(
    { company_id: companyId, qb_vendor_id: qbVendorId, name: qbVendorName, cached_at: new Date().toISOString() },
    { onConflict: 'company_id,qb_vendor_id' }
  )

  revalidatePath(`/purchase-orders/${poId}`)
  revalidatePath('/vendors')
  return { vendorId: vendor.vendor_id }
}

export async function addVendorToQBFromPO(
  vendorId: string,
  companyId: string,
  poId: string
): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { data: vendor } = await supabase
    .from('vendors')
    .select('vendor_name_display, vendor_name_extracted')
    .eq('vendor_id', vendorId)
    .single()

  if (!vendor) return { error: 'Vendor not found' }

  const displayName = vendor.vendor_name_display ?? vendor.vendor_name_extracted ?? 'Unknown Vendor'

  let qbVendorId: string
  let qbVendorName: string = displayName

  try {
    const { qbPost } = await getQBClient(companyId)
    try {
      const result = await qbPost('vendor', { DisplayName: displayName })
      qbVendorId = result.Vendor?.Id
      qbVendorName = result.Vendor?.DisplayName ?? displayName
      if (!qbVendorId) return { error: 'QuickBooks did not return a vendor ID' }
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      const dupMatch = msg.match(/"code":"6240"[\s\S]*?Id=(\d+)/)
      if (dupMatch) {
        qbVendorId = dupMatch[1]
      } else {
        throw e
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : ''
    return {
      error: msg.includes('not connected')
        ? 'QuickBooks is not connected.'
        : `Could not add vendor to QuickBooks: ${msg || 'unknown error'}`,
    }
  }

  await supabase.from('vendors').update({ qb_vendor_id: qbVendorId, qb_vendor_name: qbVendorName })
    .eq('vendor_id', vendorId)

  await supabase.from('qb_vendors_cache').upsert(
    { company_id: companyId, qb_vendor_id: qbVendorId, name: qbVendorName, cached_at: new Date().toISOString() },
    { onConflict: 'company_id,qb_vendor_id' }
  )

  revalidatePath(`/purchase-orders/${poId}`)
  revalidatePath('/vendors')
  return {}
}
