'use client'

import { usePathname } from 'next/navigation'
import { signout } from '@/app/actions/auth'
import { markNotificationRead } from '@/app/actions/notifications'
import { NotificationBell } from '@/components/notification-bell'
import { useGuardedNavigate } from '@/components/unsaved-guard'

type Notification = {
  id: string
  type: 'error' | 'success' | 'info'
  title: string
  body: string | null
  is_read: boolean
  created_at: string
  bill_id: string | null
}

export function SidebarNav({
  userEmail,
  notifications,
  unreadCount,
  jobCostingEnabled = false,
}: {
  userEmail: string | null
  notifications: Notification[]
  unreadCount: number
  jobCostingEnabled?: boolean
}) {
  const pathname = usePathname()

  const isActive = (prefix: string) =>
    prefix === '/home' ? pathname === '/home' : pathname.startsWith(prefix)

  return (
    <aside
      className="flex-none flex flex-col"
      style={{ width: 168, background: 'white', borderRight: '1px solid #D0D5DD' }}
    >
      {/* Zone 1 — Logo header */}
      <div
        className="flex-none flex items-center gap-2 px-3"
        style={{ background: '#1A3D2B', height: 52, flexShrink: 0 }}
      >
        <img src="/logo-512.png" alt="Purchasomatic" style={{ width: 28, height: 28, flexShrink: 0 }} />
        <span className="text-white" style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em' }}>
          Purchasomatic
        </span>
      </div>

      {/* Zone 2 — Navigation */}
      <nav className="flex-1 py-2 overflow-y-auto">
        <NavItem href="/home" active={isActive('/home')} icon="ti-home">Home</NavItem>
        <NavItem href="/bills" active={isActive('/bills')} icon="ti-file-invoice">Bills</NavItem>
        <NavItem href="/purchase-orders" active={isActive('/purchase-orders')} icon="ti-clipboard-list">Purchase Orders</NavItem>
        <NavItem href="/receiving" active={isActive('/receiving')} icon="ti-package">Receiving</NavItem>
        <NavItem href="/vendors" active={isActive('/vendors')} icon="ti-users">Vendors</NavItem>
        {jobCostingEnabled && (
          <NavItem href="/jobs" active={isActive('/jobs')} icon="ti-chart-bar">Job Profitability</NavItem>
        )}
        {jobCostingEnabled && (
          <NavItem href="/exports" active={isActive('/exports')} icon="ti-download">Export</NavItem>
        )}
        <div className="mx-3 my-2" style={{ height: '1px', background: '#E8ECF0' }} />
        <NavItem href="/activity" active={isActive('/activity')} icon="ti-clock">Activity Log</NavItem>
        <NavItem href="/trash" active={isActive('/trash')} icon="ti-trash">Trash</NavItem>
        <NavItem href="/billing" active={isActive('/billing')} icon="ti-credit-card">Billing</NavItem>
        <NavItem href="/settings" active={isActive('/settings')} icon="ti-settings">Settings</NavItem>
      </nav>

      {/* Footer */}
      <div style={{ borderTop: '1px solid #E8ECF0', padding: '10px 12px' }}>
        <div className="flex items-center justify-between mb-2">
          <NotificationBell
            count={unreadCount}
            notifications={notifications}
            onMarkRead={markNotificationRead}
          />
        </div>
        <a
          href="/help"
          target="_blank"
          rel="noreferrer"
          style={{ display: 'block', fontSize: 11, color: '#9CA3AF', textDecoration: 'none', marginBottom: 6 }}
        >
          <i className="ti ti-help-circle" style={{ fontSize: 11, marginRight: 4 }} />
          Help &amp; support
        </a>
        <form action={signout}>
          <button
            type="submit"
            className="w-full text-left truncate hover:underline"
            style={{ fontSize: 12, color: '#6B7280' }}
            title="Sign out"
          >
            {userEmail ?? 'Account'}
          </button>
        </form>
      </div>
    </aside>
  )
}

function NavItem({
  href,
  active,
  icon,
  children,
}: {
  href: string
  active: boolean
  icon: string
  children: React.ReactNode
}) {
  const navigate = useGuardedNavigate()
  return (
    <button
      onClick={() => navigate(href)}
      className="flex items-center gap-2 mx-2 rounded-[5px] w-full text-left"
      style={{
        padding: '7px 10px',
        fontSize: 13,
        fontWeight: active ? 600 : 400,
        color: active ? '#1A3D2B' : '#3D4856',
        background: active ? '#E6F4ED' : 'transparent',
        borderLeft: active ? '3px solid #2DB87A' : '3px solid transparent',
        borderTop: 'none',
        borderRight: 'none',
        borderBottom: 'none',
        cursor: 'pointer',
      }}
    >
      <i className={`ti ${icon}`} style={{ fontSize: 15, lineHeight: 1, opacity: active ? 1 : 0.7 }} />
      {children}
    </button>
  )
}
