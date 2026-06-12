'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Polls the server every 8 seconds so email-ingested bills appear without
// requiring a manual refresh. Only rendered when the inbox is empty.
export function InboxPoller() {
  const router = useRouter()
  useEffect(() => {
    const id = setInterval(() => router.refresh(), 8000)
    return () => clearInterval(id)
  }, [router])
  return null
}
