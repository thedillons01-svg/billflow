'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updateBill(
  billId: string,
  updates: Record<string, string | number | boolean | null>
) {
  const supabase = await createClient()
  const { error } = await supabase.from('bills').update(updates).eq('bill_id', billId)
  if (error) throw new Error(error.message)
}

export async function updateLineItem(
  lineId: string,
  updates: Record<string, string | number | null>
) {
  const supabase = await createClient()
  const { error } = await supabase.from('bill_line_items').update(updates).eq('line_id', lineId)
  if (error) throw new Error(error.message)
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
