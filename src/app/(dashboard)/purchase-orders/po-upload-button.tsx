'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

export function PoUploadButton() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isPending, startTransition] = useTransition()
  const [status, setStatus] = useState<string | null>(null)
  const router = useRouter()

  function upload(files: FileList | File[]) {
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
          setStatus(`Processing ${data.created} PO${data.created !== 1 ? 's' : ''}…`)
          router.refresh()
          setTimeout(() => setStatus(null), 4000)
        }
      } catch {
        setStatus('Upload failed — please try again')
      }
    })
  }

  return (
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
    </div>
  )
}
