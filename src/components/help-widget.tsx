'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'

type Sent = { message: string } | null

export function HelpWidget() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState<Sent>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSend() {
    const trimmed = message.trim()
    if (!trimmed || sending) return
    setSending(true)
    setError(null)
    try {
      const res = await fetch('/api/help/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, pageUrl: pathname }),
      })
      if (!res.ok) throw new Error('Failed to send')
      setSent({ message: trimmed })
      setMessage('')
    } catch {
      setError('Could not send your message. Please try again or email support@purchasomatic.com.')
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(v => !v)}
        aria-label="Help"
        style={{
          position: 'fixed', bottom: 20, right: 20, zIndex: 9998,
          width: 48, height: 48, borderRadius: '50%',
          background: '#2DB87A', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 10px rgba(0,0,0,0.18)',
        }}
      >
        <i className={open ? 'ti ti-x' : 'ti ti-message-circle-2'} style={{ fontSize: 20, color: 'white' }} />
      </button>

      {open && (
        <div
          style={{
            position: 'fixed', bottom: 80, right: 20, zIndex: 9998,
            width: 320, maxWidth: 'calc(100vw - 40px)',
            background: 'white', borderRadius: 10,
            border: '0.5px solid var(--color-border-secondary)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.16)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}
        >
          <div style={{ background: '#1A3D2B', padding: '12px 16px' }}>
            <p style={{ fontSize: 13, fontWeight: 500, color: 'white' }}>Help &amp; Support</p>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>
              Send Heather a message — she&apos;ll get it right away.
            </p>
          </div>

          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sent && (
              <div
                style={{
                  background: '#EBF5EF', border: '1px solid #C3DEC9', borderRadius: 6,
                  padding: '10px 12px', fontSize: 12, color: '#1A3D2B', lineHeight: 1.5,
                }}
              >
                Sent — thanks! Heather will follow up by text or email.
              </div>
            )}

            {error && (
              <div
                style={{
                  background: 'var(--bf-status-error-bg, #FEE2E2)', borderRadius: 6,
                  padding: '10px 12px', fontSize: 12, color: 'var(--bf-status-error-text, #991B1B)', lineHeight: 1.5,
                }}
              >
                {error}
              </div>
            )}

            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)' }}>
              What do you need help with?
            </label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Describe what's going on..."
              rows={4}
              style={{
                minHeight: 80, border: '0.5px solid var(--color-border-secondary)',
                borderRadius: 6, padding: '8px 10px', fontSize: 13, resize: 'vertical',
                fontFamily: 'inherit',
              }}
            />
            <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
              This goes straight to Heather, along with the page you&apos;re on. She usually responds within a few minutes during business hours.
            </p>

            <button
              onClick={handleSend}
              disabled={sending || !message.trim()}
              style={{
                marginTop: 4, background: sending || !message.trim() ? '#9AD4B8' : '#2DB87A',
                color: 'white', fontSize: 13, fontWeight: 500,
                padding: '7px 16px', borderRadius: 6, border: 'none',
                cursor: sending || !message.trim() ? 'default' : 'pointer',
              }}
            >
              {sending ? 'Sending…' : 'Send message'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
