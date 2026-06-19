'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function addTechnician(formData: FormData) {
  const name  = (formData.get('name')  as string | null)?.trim()
  const phone = (formData.get('phone') as string | null)?.trim() || null
  if (!name) return

  const supabase = await createClient()
  const { data: company } = await supabase.from('companies').select('company_id').single()
  if (!company) return

  await supabase.from('technicians').insert({ company_id: company.company_id, name, phone })
  revalidatePath('/settings/technicians')
}

export async function updateTechnician(technicianId: string, formData: FormData) {
  const name  = (formData.get('name')  as string | null)?.trim()
  const phone = (formData.get('phone') as string | null)?.trim() || null
  if (!name) return

  const supabase = await createClient()
  await supabase.from('technicians').update({ name, phone }).eq('technician_id', technicianId)
  revalidatePath('/settings/technicians')
}

export async function deactivateTechnician(technicianId: string) {
  const supabase = await createClient()
  await supabase.from('technicians').update({ is_active: false }).eq('technician_id', technicianId)
  revalidatePath('/settings/technicians')
}

export async function reactivateTechnician(technicianId: string) {
  const supabase = await createClient()
  await supabase.from('technicians').update({ is_active: true }).eq('technician_id', technicianId)
  revalidatePath('/settings/technicians')
}
