'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export function BillsRealtime({ companyId }: { companyId: string }) {
  const [toastVisible, setToastVisible] = useState(false)
  const sinceRef = useRef<string>(new Date().toISOString())
  const reloadScheduled = useRef(false)

  function scheduleReload() {
    if (reloadScheduled.current) return
    reloadScheduled.current = true
    setToastVisible(true)
    setTimeout(() => { window.location.reload() }, 800)
  }

  // Realtime: filtered to this company so WALRUS evaluates RLS correctly
  useEffect(() => {
    if (!companyId) return
    const supabase = createClient()
    const channel = supabase
      .channel(`bills-inbox-${companyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bills',
          filter: `company_id=eq.${companyId}`,
        },
        () => { scheduleReload() }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId])

  // Polling fallback: check every 12s for bills newer than page-load time
  useEffect(() => {
    if (!companyId) return
    const supabase = createClient()
    const since = sinceRef.current

    const interval = setInterval(async () => {
      if (reloadScheduled.current) return
      const { count } = await supabase
        .from('bills')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .gt('created_at', since)
      if (count && count > 0) scheduleReload()
    }, 12000)

    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId])

  if (!toastVisible) return null

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 9999,
        background: '#1A3D2B',
        color: 'white',
        fontSize: 13,
        fontWeight: 500,
        padding: '10px 16px',
        borderRadius: 8,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: '#2DB87A',
          display: 'inline-block',
          animation: 'pulse 1s infinite',
        }}
      />
      Receiving invoice…
    </div>
  )
}
