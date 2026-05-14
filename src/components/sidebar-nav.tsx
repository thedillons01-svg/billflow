'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signout } from '@/app/actions/auth'

export function SidebarNav({ userEmail }: { userEmail: string | null }) {
  const pathname = usePathname()

  const isActive = (prefix: string) =>
    prefix === '/' ? pathname === '/' : pathname.startsWith(prefix)

  return (
    <aside
      className="flex-none flex flex-col"
      style={{ width: 160, background: '#EBF5EF', borderRight: '0.5px solid #C3DEC9' }}
    >
      {/* Zone 1 — Logo header */}
      <div
        className="flex-none flex items-center gap-2 px-3 py-[14px]"
        style={{ background: '#1A3D2B' }}
      >
        <div
          className="flex-none flex items-center justify-center rounded-[6px] text-white"
          style={{
            width: 26, height: 26,
            background: '#2DB87A',
            fontSize: 11, fontWeight: 700,
          }}
        >
          B
        </div>
        <span className="text-white font-medium" style={{ fontSize: 13 }}>BillFlow</span>
      </div>

      {/* Zone 2 — Navigation */}
      <nav className="flex-1 py-2 overflow-y-auto">
        <NavItem href="/" active={isActive('/')} icon="ti-home">Home</NavItem>
        <NavItem href="/bills" active={isActive('/bills')} icon="ti-file-invoice">Bills</NavItem>
        <NavItem href="/purchase-orders" active={isActive('/purchase-orders')} icon="ti-clipboard-list">Purchase Orders</NavItem>
        <NavItem href="/receiving" active={isActive('/receiving')} icon="ti-package">Receiving</NavItem>
        <NavItem href="/vendors" active={isActive('/vendors')} icon="ti-users">Vendors</NavItem>
        <NavItem href="/jobs" active={isActive('/jobs')} icon="ti-chart-bar">Job Profitability</NavItem>
        <NavItem href="/exports" active={isActive('/exports')} icon="ti-download">FSM Export</NavItem>
        <div
          className="my-2"
          style={{ height: '0.5px', background: '#C3DEC9', marginLeft: 12, marginRight: 12 }}
        />
        <NavItem href="/activity" active={isActive('/activity')} icon="ti-clock">Activity Log</NavItem>
        <NavItem href="/trash" active={isActive('/trash')} icon="ti-trash">Trash</NavItem>
        <NavItem href="/billing" active={isActive('/billing')} icon="ti-credit-card">Billing</NavItem>
        <NavItem href="/settings" active={isActive('/settings')} icon="ti-settings">Settings</NavItem>
      </nav>

      {/* Footer — user email */}
      <div style={{ borderTop: '0.5px solid #C3DEC9', padding: '10px 12px' }}>
        <form action={signout}>
          <button
            type="submit"
            className="w-full text-left truncate hover:underline"
            style={{ fontSize: 10, color: '#5A8C6A' }}
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
  return (
    <Link
      href={href}
      className="flex items-center gap-2 mx-1 rounded-[4px]"
      style={{
        padding: '7px 11px',
        fontSize: 12,
        fontWeight: active ? 500 : 400,
        color: active ? '#1A3D2B' : '#5A8C6A',
        background: active ? '#C3DEC9' : 'transparent',
        borderLeft: active ? '2px solid #2DB87A' : '2px solid transparent',
        textDecoration: 'none',
      }}
    >
      <i className={`ti ${icon}`} style={{ fontSize: 14, lineHeight: 1 }} />
      {children}
    </Link>
  )
}
