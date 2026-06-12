'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export function BillsRealtime({
  companyId,
  draftBillIds = [],
}: {
  companyId: string
  draftBillIds?: string[]
}) {
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

  // Polling: new bills created after page load
  useEffect(() => {
    if (!companyId) return
    const supabase = createClient()
    const since = sinceRef.current

    const interval = setInterval(async () => {
      if (reloadScheduled.current) return
      const { count } = await supabase
        .from('bills')
        .select('bill_id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .gt('created_at', since)
      if (count && count > 0) scheduleReload()
    }, 4000)

    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId])

  // Polling: bills that were already draft when the page loaded — watch for them to clear
  useEffect(() => {
    if (draftBillIds.length === 0) return
    const supabase = createClient()

    const interval = setInterval(async () => {
      if (reloadScheduled.current) return
      const { data } = await supabase
        .from('bills')
        .select('bill_id, status')
        .in('bill_id', draftBillIds)
      const allCleared = data?.every(b => b.status !== 'draft') ?? false
      if (allCleared) scheduleReload()
    }, 3000)

    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftBillIds.join(',')])

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
