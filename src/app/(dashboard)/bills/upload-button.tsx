'use client'

import { useRef, useState, useTransition, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function UploadButton() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isPending, startTransition] = useTransition()
  const [status, setStatus] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const dragCounterRef = useRef(0)
  const router = useRouter()

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
              const supabase = createClient()
              const pending = new Set(ids)
              let cleaned = false

              const cleanup = (channel: ReturnType<typeof supabase.channel>, timer: ReturnType<typeof setTimeout>) => {
                if (cleaned) return
                cleaned = true
                clearTimeout(timer)
                supabase.removeChannel(channel)
                router.refresh()
                setStatus(null)
              }

              const channel = supabase.channel('bill-processing')

              const fallback = setTimeout(() => cleanup(channel, fallback), 45_000)

              channel
                .on(
                  'postgres_changes',
                  { event: 'UPDATE', schema: 'public', table: 'bills' },
                  (payload) => {
                    const row = payload.new as { bill_id: string; status: string }
                    if (pending.has(row.bill_id) && row.status !== 'draft') {
                      pending.delete(row.bill_id)
                    }
                    if (pending.size === 0) {
                      cleanup(channel, fallback)
                    }
                  }
                )
                .subscribe()
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
      {dragging && (
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
        {status && (
          <span style={{ fontSize: 12, color: isPending ? 'var(--color-text-secondary)' : '#065F46' }}>
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
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            height: 32,
            paddingLeft: 12,
            paddingRight: 14,
            background: isPending ? '#E5E7EB' : '#2DB87A',
            color: isPending ? 'var(--color-text-secondary)' : 'white',
            borderRadius: 6,
            border: 'none',
            fontSize: 12,
            fontWeight: 500,
            cursor: isPending ? 'not-allowed' : 'pointer',
          }}
        >
          <i className={`ti ${isPending ? 'ti-loader-2' : 'ti-upload'}`} style={{ fontSize: 13 }} />
          {isPending ? 'Processing…' : 'Upload PDFs'}
        </button>
      </div>
    </>
  )
}
