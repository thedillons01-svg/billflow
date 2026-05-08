'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function recordExport(params: {
  format: 'pdf' | 'excel'
  dateStart: string | null
  dateEnd: string | null
  vendorIds: string[]
  jobIds: string[]
  billIds: string[]
}) {
  const supabase = await createClient()
  const { data: company } = await supabase.from('companies').select('company_id').single()
  if (!company) return

  await supabase.from('exports').insert({
    company_id: company.company_id,
    format: params.format,
    date_range_start: params.dateStart,
    date_range_end: params.dateEnd,
    vendor_filter: params.vendorIds.length ? params.vendorIds : null,
    job_filter: params.jobIds.length ? params.jobIds : null,
    bill_ids_included: params.billIds.length ? params.billIds : null,
  })

  revalidatePath('/exports')
}
