'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getQBClient } from '@/lib/quickbooks/client'

export async function saveClassSetup(
  companyId: string,
  mode: 'vendor' | 'customer',
  vendorChanges: { vendorId: string; classId: string | null }[],
  customerChanges: { qbJobId: string; classId: string | null }[],
): Promise<void> {
  const supabase = await createClient()

  await supabase.from('companies').update({ class_assignment_mode: mode }).eq('company_id', companyId)

  // Batch vendor updates — group by classId so assigning many vendors to one class is a single query
  if (vendorChanges.length > 0) {
    const byClass = new Map<string | null, string[]>()
    for (const { vendorId, classId } of vendorChanges) {
      if (!byClass.has(classId)) byClass.set(classId, [])
      byClass.get(classId)!.push(vendorId)
    }
    for (const [classId, vendorIds] of byClass) {
      await supabase.from('vendors')
        .update({ billflow_class_id: classId, class_source: classId ? 'Purchasomatic_override' : 'not_set' })
        .in('vendor_id', vendorIds)
    }
  }

  // Batch customer updates — same grouping approach
  if (customerChanges.length > 0) {
    const byClass = new Map<string | null, string[]>()
    for (const { qbJobId, classId } of customerChanges) {
      if (!byClass.has(classId)) byClass.set(classId, [])
      byClass.get(classId)!.push(qbJobId)
    }
    for (const [classId, jobIds] of byClass) {
      await supabase.from('qb_jobs_cache')
        .update({ assigned_class_id: classId })
        .eq('company_id', companyId)
        .in('qb_job_id', jobIds)
    }
  }

  revalidatePath('/settings/classes')
  revalidatePath('/settings')
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
