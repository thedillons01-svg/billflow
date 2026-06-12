'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export function BillsRealtime({ companyId: _companyId }: { companyId: string }) {
  const [toastVisible, setToastVisible] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('bills-inbox')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bills' },
        () => {
          setToastVisible(true)
          setTimeout(() => {
            window.location.reload()
          }, 800)
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

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
          width: 8, height: 8, borderRadius: '50%',
          background: '#2DB87A',
          display: 'inline-block',
          animation: 'pulse 1s infinite',
        }}
      />
      Receiving invoice…
    </div>
  )
}
