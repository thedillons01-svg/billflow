'use client'

import { useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function BillsRealtime({ companyId: _companyId }: { companyId: string }) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('bills-inbox')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bills',
          // No row-level filter — the RLS policy on bills already limits rows to this
          // user's company. Filters + subquery-based RLS policies can cause Realtime
          // to silently drop events when WALRUS can't evaluate the filter in that context.
        },
        () => startTransition(() => router.refresh())
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [router, startTransition])

  return null
}
