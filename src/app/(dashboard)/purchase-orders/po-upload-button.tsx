'use client'

import Link from 'next/link'
import { useRef, useState, useTransition, useCallback } from 'react'
import { useRouter } from 'next/navigation'

function blockedInfo(creditBalance: number, subscriptionStatus: string): { message: string; cta: string } | null {
  if (creditBalance > 0 || subscriptionStatus === 'active') return null
  if (subscriptionStatus === 'past_due') return { message: 'Payment failed — POs cannot be processed until billing is updated.', cta: 'Fix billing →' }
  if (subscriptionStatus === 'canceled') return { message: 'Subscription canceled — resubscribe to continue processing POs.', cta: 'Resubscribe →' }
  return { message: 'Your 25 trial credits are used up. Subscribe to keep processing purchase orders.', cta: 'Subscribe →' }
}

export function PoUploadButton({ creditBalance = 1, subscriptionStatus = 'trial' }: { creditBalance?: number; subscriptionStatus?: string }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isPending, startTransition] = useTransition()
  const [status, setStatus] = useState<string | null>(null)
  const router = useRouter()
  const blocked = blockedInfo(creditBalance, subscriptionStatus)

  const upload = useCallback((files: FileList | File[]) => {
    const arr = Array.from(files)
    if (arr.length === 0) return

    const formData = new FormData()
    for (const file of arr) formData.append('files', file)

    setStatus('Uploading…')
    startTransition(async () => {
      try {
        const res = await fetch('/api/pos/upload', { method: 'POST', body: formData })
        const data = await res.json()
        if (!res.ok) {
          setStatus(`Error: ${data.error ?? 'Upload failed'}`)
        } else if (data.created === 0 && data.errorDetails?.length > 0) {
          setStatus(`Upload failed: ${data.errorDetails[0]}`)
        } else {
          const n = data.created
          setStatus(`Processing ${n} PO${n !== 1 ? 's' : ''}…`)
          router.refresh()

          const ids: string[] = data.ids ?? []
          if (ids.length > 0) {
            const deadline = Date.now() + 45_000
            const poll = async () => {
              if (Date.now() > deadline) { setStatus(null); return }
              const r = await fetch(`/api/pos/poll-status?ids=${ids.join(',')}`)
              const d = await r.json()
              const ready: string[] = d.ready ?? []
              router.refresh()
              if (ready.length >= ids.length) {
                setStatus(null)
              } else {
                setTimeout(poll, 2500)
              }
            }
            setTimeout(poll, 2500)
          } else {
            setTimeout(() => setStatus(null), 4000)
          }
        }
      } catch {
        setStatus('Upload failed — please try again')
      }
    })
  }, [router])

  return (
    <div className="flex items-center gap-3">
      {blocked ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: '#FEF2F2', border: '0.5px solid #FECACA',
            borderRadius: 6, padding: '6px 10px', maxWidth: 340,
          }}>
            <i className="ti ti-alert-circle" style={{ fontSize: 13, color: '#DC2626', flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: '#991B1B' }}>{blocked.message}</span>
            <Link
              href="/billing"
              style={{ fontSize: 12, fontWeight: 600, color: '#DC2626', whiteSpace: 'nowrap', textDecoration: 'none' }}
            >
              {blocked.cta}
            </Link>
          </div>
          <button
            type="button"
            disabled
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              height: 32, paddingLeft: 12, paddingRight: 14,
              background: '#E5E7EB', color: '#9CA3AF',
              borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 500,
              cursor: 'not-allowed',
            }}
          >
            <i className="ti ti-upload" style={{ fontSize: 13 }} />
            Upload PDFs
          </button>
        </div>
      ) : (
        <>
          {status && (
            <span style={{ fontSize: 12, color: isPending ? 'var(--color-text-secondary)' : status.startsWith('Error:') ? '#DC2626' : '#065F46' }}>
              {status}
            </span>
          )}
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,application/pdf"
            multiple
            className="hidden"
            onChange={e => { if (e.target.files) upload(e.target.files); e.target.value = '' }}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={isPending}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              height: 32, paddingLeft: 12, paddingRight: 14,
              background: isPending ? '#E5E7EB' : '#2DB87A',
              color: isPending ? 'var(--color-text-secondary)' : 'white',
              borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 500,
              cursor: isPending ? 'not-allowed' : 'pointer',
            }}
          >
            <i className={`ti ${isPending ? 'ti-loader-2' : 'ti-upload'}`} style={{ fontSize: 13 }} />
            {isPending ? 'Processing…' : 'Upload PDFs'}
          </button>
        </>
      )}
    </div>
  )
}
