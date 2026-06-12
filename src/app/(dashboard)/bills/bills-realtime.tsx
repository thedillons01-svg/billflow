'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function BillsRealtime({ companyId: _companyId }: { companyId: string }) {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('bills-inbox')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bills' },
        () => {
          // Force a real navigation to the current URL with a cache-busting param.
          // router.refresh() can serve stale cached data in production; a URL change
          // always causes the server component to re-run with fresh data from Supabase.
          const url = new URL(window.location.href)
          url.searchParams.set('_t', Date.now().toString())
          router.replace(url.pathname + url.search, { scroll: false })
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [router]) // stable ref — no re-subscribe on every event

  return null
}
