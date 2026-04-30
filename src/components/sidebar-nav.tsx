'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { signout } from '@/app/actions/auth'

export function SidebarNav({ userEmail }: { userEmail: string | null }) {
  const pathname = usePathname()

  return (
    <aside className="w-56 flex-none flex flex-col bg-slate-900">
      {/* Logo */}
      <div className="flex h-14 flex-none items-center gap-2.5 px-4 border-b border-white/[0.06]">
        <div className="flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-blue-500">
          <svg className="h-3.5 w-3.5 text-white" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0 1 12 2v5h4a1 1 0 0 1 .82 1.573l-7 10A1 1 0 0 1 8 18v-5H4a1 1 0 0 1-.82-1.573l7-10a1 1 0 0 1 1.12-.38Z" clipRule="evenodd" />
          </svg>
        </div>
        <span className="text-[15px] font-semibold tracking-tight text-white">BillFlow</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
        <NavLink href="/" active={pathname === '/'}>
          <HomeIcon />
          Home
        </NavLink>
        <NavLink href="/bills" active={pathname.startsWith('/bills')}>
          <BillsIcon />
          Bills
        </NavLink>
        <NavLink href="/settings" active={pathname.startsWith('/settings')}>
          <SettingsIcon />
          Settings
        </NavLink>
      </nav>

      {/* User menu */}
      <UserMenu email={userEmail} />
    </aside>
  )
}

function NavLink({
  href,
  active,
  children,
}: {
  href: string
  active: boolean
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
        active
          ? 'bg-slate-700 text-white'
          : 'text-slate-300 hover:bg-white/[0.06] hover:text-white'
      }`}
    >
      {children}
    </Link>
  )
}

function UserMenu({ email }: { email: string | null }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const initial = email?.[0]?.toUpperCase() ?? 'U'

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div ref={ref} className="relative flex-none border-t border-white/[0.06] p-3">
      {open && (
        <div className="absolute bottom-full left-2 right-2 z-50 mb-1 overflow-hidden rounded-lg bg-slate-800 shadow-xl ring-1 ring-white/[0.08]">
          <div className="px-3 py-2 border-b border-white/[0.06]">
            <p className="truncate text-xs text-slate-400">{email ?? 'Account'}</p>
          </div>
          <form action={signout}>
            <button
              type="submit"
              className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-slate-300 transition-colors hover:bg-white/[0.06] hover:text-white"
            >
              <SignOutIcon />
              Sign out
            </button>
          </form>
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-white/[0.06]"
      >
        <div className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-slate-600 text-xs font-semibold text-white">
          {initial}
        </div>
        <span className="flex-1 truncate text-xs text-slate-300">{email ?? 'Account'}</span>
      </button>
    </div>
  )
}

function HomeIcon() {
  return (
    <svg className="h-4 w-4 flex-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9,22 9,12 15,12 15,22" />
    </svg>
  )
}

function BillsIcon() {
  return (
    <svg className="h-4 w-4 flex-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14,2 14,8 20,8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  )
}

function SettingsIcon() {
  return (
    <svg className="h-4 w-4 flex-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

function SignOutIcon() {
  return (
    <svg className="h-4 w-4 flex-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16,17 21,12 16,7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  )
}
