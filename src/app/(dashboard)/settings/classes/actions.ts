'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getQBClient } from '@/lib/quickbooks/client'

export async function setClassAssignmentMode(companyId: string, mode: 'vendor' | 'customer') {
  const supabase = await createClient()
  await supabase
    .from('companies')
    .update({ class_assignment_mode: mode })
    .eq('company_id', companyId)
  revalidatePath('/settings/classes')
}

export async function assignVendorToClass(vendorId: string, classId: string | null) {
  const supabase = await createClient()
  await supabase
    .from('vendors')
    .update({
      billflow_class_id: classId,
      class_source: classId ? 'Purchasomatic_override' : 'not_set',
    })
    .eq('vendor_id', vendorId)
  revalidatePath('/settings/classes')
}

export async function assignCustomerToClass(companyId: string, qbJobId: string, classId: string | null) {
  const supabase = await createClient()
  await supabase
    .from('qb_jobs_cache')
    .update({ assigned_class_id: classId })
    .eq('company_id', companyId)
    .eq('qb_job_id', qbJobId)
  revalidatePath('/settings/classes')
}

export async function createQBClass(companyId: string, name: string): Promise<{ qb_class_id: string; name: string } | { error: string }> {
  const trimmed = name.trim()
  if (!trimmed) return { error: 'Class name is required.' }
  try {
    const { qbPost } = await getQBClient(companyId)
    const result = await qbPost('class', { Name: trimmed, Active: true })
    const cls = result?.Class
    if (!cls?.Id) return { error: 'QuickBooks did not return a class ID. Check that Class Tracking is enabled in QB settings.' }
    const supabase = await createClient()
    await supabase.from('qb_classes_cache').upsert(
      { company_id: companyId, qb_class_id: cls.Id, name: cls.Name },
      { onConflict: 'company_id,qb_class_id' }
    )
    revalidatePath('/settings/classes')
    return { qb_class_id: cls.Id, name: cls.Name }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to create class in QuickBooks.' }
  }
}
