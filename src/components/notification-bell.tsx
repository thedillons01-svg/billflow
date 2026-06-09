'use client'

import { useState } from 'react'

type Notification = {
  id: string
  type: 'error' | 'success' | 'info'
  title: string
  body: string | null
  is_read: boolean
  created_at: string
  bill_id: string | null
}

export function NotificationBell({
  count,
  notifications,
  onMarkRead,
}: {
  count: number
  notifications: Notification[]
  onMarkRead: (id: string) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  function handleNotificationClick(n: Notification) {
    // Don't close if the user just finished selecting text to copy
    if (window.getSelection()?.toString()) return
    onMarkRead(n.id)
    setOpen(false)
  }

  async function handleCopy(e: React.MouseEvent, n: Notification) {
    e.stopPropagation()
    const text = [n.title, n.body].filter(Boolean).join('\n')
    await navigator.clipboard.writeText(text)
    setCopied(n.id)
    setTimeout(() => setCopied(null), 2000)
  }

  function reportHref(n: Notification) {
    const subject = encodeURIComponent(`Error Report: ${n.title}`)
    const lines = [
      `Error: ${n.title}`,
      n.body ? `Details: ${n.body}` : null,
      n.bill_id ? `Bill ID: ${n.bill_id}` : null,
      `Time: ${new Date(n.created_at).toLocaleString()}`,
    ].filter(Boolean).join('\n')
    return `mailto:support@purchasomatic.com?subject=${subject}&body=${encodeURIComponent(lines)}`
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="relative flex items-center justify-center"
        style={{ color: 'var(--color-text-secondary)' }}
        aria-label="Notifications"
      >
        <i className="ti ti-bell" style={{ fontSize: 18 }} />
        {count > 0 && (
          <span
            className="absolute flex items-center justify-center"
            style={{
              top: -4, right: -4,
              width: 14, height: 14,
              background: '#E53E3E',
              borderRadius: '50%',
              border: '2px solid white',
              fontSize: 8,
              fontWeight: 700,
              color: 'white',
              lineHeight: 1,
            }}
          >
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div
            className="absolute left-0 bottom-8 z-50 overflow-hidden rounded-[6px] bg-white shadow-lg"
            style={{
              width: 340,
              border: '0.5px solid var(--color-border-tertiary)',
              maxHeight: 420,
              overflowY: 'auto',
            }}
          >
            <div
              className="flex items-center justify-between px-4 py-3"
              style={{ borderBottom: '0.5px solid var(--color-border-tertiary)' }}
            >
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>
                Notifications
              </span>
              {count > 0 && (
                <span style={{ fontSize: 10, color: 'var(--color-text-secondary)' }}>
                  {count} unread
                </span>
              )}
            </div>

            {notifications.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <i className="ti ti-check" style={{ fontSize: 24, color: '#2DB87A' }} />
                <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 8 }}>
                  No notifications
                </p>
              </div>
            ) : (
              <div>
                {notifications.map(n => (
                  <div
                    key={n.id}
                    className="flex items-start gap-3 px-4 py-3"
                    style={{
                      borderBottom: '0.5px solid var(--color-border-tertiary)',
                      background: n.is_read ? 'white' : (n.type === 'error' ? '#FEF2F2' : '#EBF5EF'),
                      cursor: 'default',
                    }}
                    onClick={() => handleNotificationClick(n)}
                  >
                    <i
                      className={`ti ${n.type === 'error' ? 'ti-alert-triangle' : n.type === 'success' ? 'ti-circle-check' : 'ti-info-circle'}`}
                      style={{
                        fontSize: 14,
                        marginTop: 1,
                        color: n.type === 'error' ? '#DC2626' : '#2DB87A',
                        flexShrink: 0,
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-primary)', userSelect: 'text' }}>
                        {n.title}
                      </p>
                      {n.body && (
                        <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2, userSelect: 'text' }}>
                          {n.body}
                        </p>
                      )}
                      <p style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginTop: 3 }}>
                        {new Date(n.created_at).toLocaleString()}
                      </p>
                      {n.type === 'error' && (
                        <div className="flex items-center gap-3 mt-2">
                          <button
                            onClick={e => handleCopy(e, n)}
                            title="Copy error text"
                            style={{
                              display: 'flex', alignItems: 'center', gap: 3,
                              background: 'none', border: 'none', cursor: 'pointer',
                              padding: 0, fontSize: 10, color: copied === n.id ? '#2DB87A' : '#DC2626',
                            }}
                          >
                            <i className={`ti ${copied === n.id ? 'ti-check' : 'ti-clipboard'}`} style={{ fontSize: 11 }} />
                            {copied === n.id ? 'Copied' : 'Copy'}
                          </button>
                          <a
                            href={reportHref(n)}
                            onClick={e => e.stopPropagation()}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 3,
                              fontSize: 10, color: '#DC2626', textDecoration: 'none',
                            }}
                          >
                            <i className="ti ti-send" style={{ fontSize: 11 }} />
                            Report this problem
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
