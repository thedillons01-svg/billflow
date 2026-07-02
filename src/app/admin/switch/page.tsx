'use client'
import { useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

function SwitchInner() {
  const router = useRouter()
  const params = useSearchParams()

  useEffect(() => {
    const email = params.get('email')
    const otp = params.get('otp')
    if (!email || !otp) { router.replace('/admin'); return }

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )

    supabase.auth.verifyOtp({ email, token: otp, type: 'magiclink' }).then(({ error }) => {
      if (error) {
        console.error('Switch failed:', error.message)
        router.replace('/admin')
        return
      }
      router.replace('/bills')
    })
  }, [params, router])

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'system-ui' }}>
      <p style={{ color: '#6b7280', fontSize: 14 }}>Switching accounts…</p>
    </div>
  )
}

export default function SwitchPage() {
  return (
    <Suspense>
      <SwitchInner />
    </Suspense>
  )
}
