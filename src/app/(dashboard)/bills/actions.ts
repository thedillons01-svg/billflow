'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getQBClient } from '@/lib/quickbooks/client'

// Recomputes draft ↔ ready based on data completeness.
// Only touches bills in those two states — never overwrites sync_error, published, etc.
// Recomputes draft ↔ ready based on data completeness.
// Only touches bills in those two states — never overwrites sync_error, published, etc.
export async function refreshBillStatus(billId: string) {
  const supabase = await createClient()
  const { data: bill } = await supabase
    .from('bills')
    .select('status, vendor_id, total, bill_line_items(gl_account_id, extended_cost)')
    .eq('bill_id', billId)
    .single()
  if (!bill || !['draft', 'ready'].includes(bill.status)) return
  const lines = (bill.bill_line_items ?? []) as { gl_account_id: string | null; extended_cost: number | null }[]
  const hasVendor = bill.vendor_id != null
  const allLinesHaveGL = lines.length > 0 && lines.every(li => li.gl_account_id != null)
  const lineSum = lines.reduce((s, li) => s + (li.extended_cost ?? 0), 0)
  const totalsMatch = bill.total == null || Math.abs(lineSum - (bill.total as number)) <= 0.01
  const newStatus = hasVendor && allLinesHaveGL && totalsMatch ? 'ready' : 'draft'
  if (newStatus !== bill.status) {
    await supabase.from('bills').update({ status: newStatus }).eq('bill_id', billId)
  }
}

export async function updateBill(
  billId: string,
  updates: Record<string, string | number | boolean | null>
) {
  const supabase = await createClient()
  const { error } = await supabase.from('bills').update(updates).eq('bill_id', billId)
  if (error) throw new Error(error.message)
  if ('vendor_id' in updates) {
    await refreshBillStatus(billId)
    // Auto-save alias so future invoices with this extracted name auto-match to the same vendor
    const newVendorId = updates.vendor_id as string | null
    if (newVendorId) {
      const { data: bill } = await supabase
        .from('bills')
        .select('vendor_name_raw, company_id')
        .eq('bill_id', billId)
        .single()
      if (bill?.vendor_name_raw && bill.company_id) {
        await supabase.from('vendor_name_aliases').upsert(
          { company_id: bill.company_id, vendor_id: newVendorId, alias_name: bill.vendor_name_raw },
          { onConflict: 'company_id,alias_name' }
        )
      }
    }
  }
}

export async function updateLineItem(
  lineId: string,
  updates: Record<string, string | number | null>
) {
  const supabase = await createClient()
  const { error } = await supabase.from('bill_line_items').update(updates).eq('line_id', lineId)
  if (error) throw new Error(error.message)
  if ('gl_account_id' in updates) {
    const { data: li } = await supabase.from('bill_line_items').select('bill_id').eq('line_id', lineId).single()
    if (li?.bill_id) await refreshBillStatus(li.bill_id)
  }
}

export async function setBillStatus(billId: string, status: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('bills').update({ status }).eq('bill_id', billId)
  if (error) throw new Error(error.message)
}

export async function softDeleteBill(billId: string) {
  const supabase = await createClient()
  await supabase
    .from('bills')
    .update({ deleted_at: new Date().toISOString() })
    .eq('bill_id', billId)
  revalidatePath('/bills')
}

export async function addLineItem(billId: string, companyId: string) {
  const supabase = await createClient()
  const { data: existing } = await supabase
    .from('bill_line_items')
    .select('sort_order')
    .eq('bill_id', billId)
    .order('sort_order', { ascending: false })
    .limit(1)

  const nextOrder = (existing?.[0]?.sort_order ?? -1) + 1
  const { error } = await supabase.from('bill_line_items').insert({
    bill_id: billId,
    company_id: companyId,
    sort_order: nextOrder,
  })
  if (error) throw new Error(error.message)
  revalidatePath(`/bills/${billId}`)
}

export async function deleteLineItem(lineId: string, billId: string) {
  const supabase = await createClient()
  await supabase.from('bill_line_items').delete().eq('line_id', lineId)
  revalidatePath(`/bills/${billId}`)
}

export async function enableVendorAutoPublish(vendorId: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('vendors')
    .update({ auto_publish_enabled: true })
    .eq('vendor_id', vendorId)
  if (error) throw new Error(error.message)
  revalidatePath('/bills')
  revalidatePath(`/vendors/${vendorId}`)
}

export async function saveLineItemMapping(
  vendorId: string,
  descriptionText: string,
  glAccountId: string
) {
  if (!descriptionText.trim()) return
  const supabase = await createClient()
  await supabase
    .from('vendor_line_item_mappings')
    .upsert(
      { vendor_id: vendorId, description_text: descriptionText.trim(), gl_account_id: glAccountId },
      { onConflict: 'vendor_id,description_text' }
    )
}

export async function saveVendorPaymentDefaults(
  vendorId: string,
  updates: { default_payment_account_id?: string | null; default_payment_method?: string | null }
) {
  const supabase = await createClient()
  await supabase.from('vendors').update(updates).eq('vendor_id', vendorId)
}

export async function saveVendorGlDefault(vendorId: string, glAccountId: string) {
  const supabase = await createClient()
  await supabase.from('vendors').update({
    billflow_gl_account_id: glAccountId,
    gl_account_source: 'billflow_override',
  }).eq('vendor_id', vendorId)
  revalidatePath('/vendors')
}

export async function saveVendorClassDefault(vendorId: string, classId: string) {
  const supabase = await createClient()
  await supabase.from('vendors').update({
    billflow_class_id: classId,
    class_source: 'Purchasomatic_override',
  }).eq('vendor_id', vendorId)
}

export async function processAnyway(billId: string) {
  const supabase = await createClient()
  await supabase.from('bills').update({ status: 'draft' }).eq('bill_id', billId)
  // Fire-and-forget OCR in background — the page will reload
  const { processBill } = await import('@/lib/ocr/process')
  processBill(billId, { skipCredits: true }).catch(console.error)
  revalidatePath('/activity')
}

export async function createVendorFromBill(
  billId: string,
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
      // QB error 6240 = duplicate name — vendor already exists, extract its ID
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

  const { error: billError } = await supabase
    .from('bills')
    .update({ vendor_id: vendor.vendor_id, autopublish_hold_reason: null })
    .eq('bill_id', billId)
  if (billError) return { error: billError.message }
  await refreshBillStatus(billId)

  // Keep cache in sync so the QB vendor dropdown shows the new vendor immediately
  await supabase.from('qb_vendors_cache').upsert(
    { company_id: companyId, qb_vendor_id: qbVendorId, name: qbVendorName, cached_at: new Date().toISOString() },
    { onConflict: 'company_id,qb_vendor_id' }
  )

  revalidatePath('/bills')
  revalidatePath(`/bills/${billId}`)
  revalidatePath('/vendors')
  return { vendorId: vendor.vendor_id }
}

export async function addVendorToQB(
  vendorId: string,
  companyId: string,
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
        ? 'QuickBooks is not connected. Connect QuickBooks in Settings first.'
        : `Could not add vendor to QuickBooks: ${msg || 'unknown error'}`,
    }
  }

  await supabase.from('vendors').update({
    qb_vendor_id: qbVendorId,
    qb_vendor_name: qbVendorName,
  }).eq('vendor_id', vendorId)

  await supabase.from('qb_vendors_cache').upsert(
    { company_id: companyId, qb_vendor_id: qbVendorId, name: qbVendorName, cached_at: new Date().toISOString() },
    { onConflict: 'company_id,qb_vendor_id' }
  )

  revalidatePath('/bills')
  revalidatePath('/vendors')
  return {}
}

export async function getVendorBillHistory(vendorId: string, excludeBillId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('bills')
    .select('bill_id, invoice_number, invoice_date, total, status')
    .eq('vendor_id', vendorId)
    .neq('bill_id', excludeBillId)
    .is('deleted_at', null)
    .order('invoice_date', { ascending: false })
    .limit(10)
  return data ?? []
}
