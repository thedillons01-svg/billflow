'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getQBClient } from '@/lib/quickbooks/client'
import { pushPOToQBO } from '@/lib/quickbooks/push-po'
import { retryPOJobMatching } from '@/lib/ocr/process-po'

export async function updatePO(
  poId: string,
  fields: Partial<{
    vendor_id: string | null
    po_number: string | null
    order_date: string | null
    expected_delivery_date: string | null
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
  const { error } = await supabase.from('po_line_items').update(fields).eq('line_id', lineId)
  if (error) throw new Error(error.message)
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

export async function recalculateAllPOJobs(): Promise<{ updated: number; cleared: number }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { updated: 0, cleared: 0 }

  const { data: member } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', user.id)
    .single()
  if (!member) return { updated: 0, cleared: 0 }

  const serviceSupabase = createServiceClient()
  const { data: pos } = await serviceSupabase
    .from('purchase_orders')
    .select('po_id')
    .eq('company_id', member.company_id)
    .is('deleted_at', null)

  if (!pos?.length) return { updated: 0, cleared: 0 }

  let updated = 0
  let cleared = 0

  for (const po of pos) {
    const matched = await retryPOJobMatching(po.po_id, member.company_id)
    if (matched) updated++; else cleared++
  }

  revalidatePath('/purchase-orders')
  return { updated, cleared }
}

export async function softDeletePO(poId: string) {
  const supabase = await createClient()
  await supabase
    .from('purchase_orders')
    .update({ deleted_at: new Date().toISOString() })
    .eq('po_id', poId)
  revalidatePath('/purchase-orders')
}

export async function bulkPublishPOs(
  poIds: string[]
): Promise<{ success: number; failed: number; errors: { poId: string; poNumber: string | null; reason: string }[] }> {
  const supabase = createServiceClient()
  const errors: { poId: string; poNumber: string | null; reason: string }[] = []
  let success = 0

  for (const poId of poIds) {
    const { data: po } = await supabase
      .from('purchase_orders')
      .select('company_id, po_number')
      .eq('po_id', poId)
      .single()

    if (!po) {
      errors.push({ poId, poNumber: null, reason: 'PO not found' })
      continue
    }

    try {
      await pushPOToQBO(poId, po.company_id)
      success++
    } catch (err) {
      errors.push({
        poId,
        poNumber: po.po_number,
        reason: err instanceof Error ? err.message : 'Unknown error',
      })
    }
  }

  revalidatePath('/purchase-orders')
  return { success, failed: errors.length, errors }
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
