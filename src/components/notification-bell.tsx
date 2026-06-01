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
              width: 320,
              border: '0.5px solid var(--color-border-tertiary)',
              maxHeight: 400,
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
                    className="flex items-start gap-3 px-4 py-3 cursor-pointer"
                    style={{
                      borderBottom: '0.5px solid var(--color-border-tertiary)',
                      background: n.is_read ? 'white' : '#F0FAF4',
                    }}
                    onClick={() => { onMarkRead(n.id); setOpen(false) }}
                  >
                    <i
                      className={`ti ${n.type === 'error' ? 'ti-alert-triangle' : n.type === 'success' ? 'ti-circle-check' : 'ti-info-circle'}`}
                      style={{
                        fontSize: 14,
                        marginTop: 1,
                        color: n.type === 'error' ? '#DC2626' : n.type === 'success' ? '#2DB87A' : '#2563EB',
                        flexShrink: 0,
                      }}
                    />
                    <div className="min-w-0">
                      <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-primary)' }}>
                        {n.title}
                      </p>
                      {n.body && (
                        <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>
                          {n.body}
                        </p>
                      )}
                      <p style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginTop: 3 }}>
                        {new Date(n.created_at).toLocaleString()}
                      </p>
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
