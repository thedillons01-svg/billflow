'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function saveVendorGLAccounts(
  changes: { vendorId: string; glAccountId: string | null; hasQbDefault: boolean }[]
): Promise<void> {
  if (changes.length === 0) return
  const supabase = await createClient()

  for (const { vendorId, glAccountId, hasQbDefault } of changes) {
    const source = glAccountId
      ? 'billflow_override'
      : hasQbDefault ? 'qb_default' : 'not_set'
    await supabase.from('vendors')
      .update({ billflow_gl_account_id: glAccountId, gl_account_source: source })
      .eq('vendor_id', vendorId)
  }

  revalidatePath('/settings/vendor-gl')
}
