'use client'

import Link from 'next/link'
import { useRef, useState, useTransition, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

function blockedInfo(creditBalance: number, subscriptionStatus: string): { message: string; cta: string } | null {
  if (creditBalance > 0 || subscriptionStatus === 'active') return null
  if (subscriptionStatus === 'past_due') return { message: 'Payment failed — invoices cannot be processed until billing is updated.', cta: 'Fix billing →' }
  if (subscriptionStatus === 'canceled') return { message: 'Subscription canceled — resubscribe to continue processing invoices.', cta: 'Resubscribe →' }
  return { message: 'Your 25 trial credits are used up. Subscribe to keep processing invoices.', cta: 'Subscribe →' }
}

export function UploadButton({ creditBalance = 1, subscriptionStatus = 'trial' }: { creditBalance?: number; subscriptionStatus?: string }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isPending, startTransition] = useTransition()
  const [status, setStatus] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const dragCounterRef = useRef(0)
  const router = useRouter()
  const blocked = blockedInfo(creditBalance, subscriptionStatus)

  const upload = useCallback((files: FileList | File[]) => {
    const arr = Array.from(files)
    if (arr.length === 0) return

    const formData = new FormData()
    for (const file of arr) {
      formData.append('files', file)
    }

    setStatus('Uploading…')
    startTransition(async () => {
      try {
        const res = await fetch('/api/bills/upload', { method: 'POST', body: formData })
        const data = await res.json()
        if (!res.ok) {
          setStatus(`Error: ${data.error ?? 'Upload failed'}`)
        } else {
          const n = data.created
          if (n === 0 && data.errorDetails?.length > 0) {
            setStatus(`Upload failed: ${data.errorDetails[0]}`)
          } else {
            setStatus(`Processing ${n} bill${n !== 1 ? 's' : ''}…`)
            router.refresh()

            const ids: string[] = data.ids ?? []
            if (ids.length > 0) {
              const deadline = Date.now() + 45_000
              const poll = async () => {
                if (Date.now() > deadline) {
                  setStatus(null)
                  return
                }
                const r = await fetch(`/api/bills/poll-status?ids=${ids.join(',')}`)
                const d = await r.json()
                const statuses: Record<string, string> = d.statuses ?? {}
                const allDone = ids.every(id => statuses[id] && statuses[id] !== 'draft')
                router.refresh()
                if (allDone) {
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
        }
      } catch {
        setStatus('Upload failed — please try again')
      }
    })
  }, [router])

  function handleClick() {
    inputRef.current?.click()
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (files) upload(files)
    e.target.value = ''
  }

  useEffect(() => {
    function onDragEnter(e: DragEvent) {
      if (!e.dataTransfer?.types.includes('Files')) return
      dragCounterRef.current++
      setDragging(true)
    }
    function onDragLeave() {
      dragCounterRef.current--
      if (dragCounterRef.current <= 0) {
        dragCounterRef.current = 0
        setDragging(false)
      }
    }
    function onDragOver(e: DragEvent) {
      e.preventDefault()
    }
    function onDrop(e: DragEvent) {
      e.preventDefault()
      dragCounterRef.current = 0
      setDragging(false)
      const files = e.dataTransfer?.files
      if (files && files.length > 0) upload(files)
    }

    window.addEventListener('dragenter', onDragEnter)
    window.addEventListener('dragleave', onDragLeave)
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragenter', onDragEnter)
      window.removeEventListener('dragleave', onDragLeave)
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('drop', onDrop)
    }
  }, [upload])

  return (
    <>
      {dragging && !blocked && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(45, 184, 122, 0.12)',
            border: '3px dashed #2DB87A',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <div style={{
            background: 'white', borderRadius: 12, padding: '32px 48px',
            textAlign: 'center', boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
          }}>
            <i className="ti ti-file-upload" style={{ fontSize: 40, color: '#2DB87A', display: 'block', marginBottom: 12 }} />
            <p style={{ fontSize: 16, fontWeight: 500, color: '#1A3D2B' }}>Drop PDFs to upload</p>
            <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 4 }}>
              Bills will be queued for processing immediately
            </p>
          </div>
        </div>
      )}

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
              onChange={handleChange}
            />
            <button
              type="button"
              onClick={handleClick}
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
    </>
  )
}
