'use client'

import Link from 'next/link'
import { useState } from 'react'

export function MarketingNav({ isLoggedIn = false }: { isLoggedIn?: boolean }) {
  const [open, setOpen] = useState(false)

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: 'rgba(255,255,255,0.95)',
        backdropFilter: 'blur(8px)',
        borderBottom: '1px solid #E5E7EB',
      }}
    >
      <div
        style={{
          maxWidth: 1100,
          margin: '0 auto',
          padding: '0 24px',
          height: 60,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
          <img src="/logo-28.png" alt="Purchasomatic" style={{ width: 28, height: 28 }} />
          <span style={{ fontSize: 16, fontWeight: 600, color: '#1A3D2B', letterSpacing: '-0.01em' }}>
            Purchasomatic
          </span>
        </Link>

        {/* Desktop links */}
        <nav className="hidden md:flex" style={{ alignItems: 'center', gap: 6 }}>
          <Link href="/pricing" style={navLinkStyle}>Pricing</Link>
          <Link href="/help" style={navLinkStyle}>Help</Link>
          {isLoggedIn ? (
            <Link href="/home" style={ctaStyle}>
              Go to app
              <i className="ti ti-arrow-right" style={{ fontSize: 13 }} />
            </Link>
          ) : (
            <>
              <Link href="/login" style={navLinkStyle}>Sign in</Link>
              <Link href="/signup" style={ctaStyle}>Get started free</Link>
            </>
          )}
        </nav>

        {/* Mobile menu toggle */}
        <button
          type="button"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          onClick={() => setOpen(o => !o)}
          className="flex md:hidden"
          style={{
            alignItems: 'center',
            justifyContent: 'center',
            width: 36,
            height: 36,
            background: 'transparent',
            border: 'none',
            color: '#1A3D2B',
            fontSize: 22,
          }}
        >
          <i className={open ? 'ti ti-x' : 'ti ti-menu-2'} />
        </button>
      </div>

      {/* Mobile menu panel */}
      {open && (
        <nav
          className="md:hidden"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            padding: '8px 24px 16px',
            borderTop: '1px solid #E5E7EB',
            background: 'white',
          }}
        >
          <Link href="/pricing" onClick={() => setOpen(false)} style={mobileLinkStyle}>Pricing</Link>
          <Link href="/help" onClick={() => setOpen(false)} style={mobileLinkStyle}>Help</Link>
          {isLoggedIn ? (
            <Link href="/home" onClick={() => setOpen(false)} style={{ ...mobileLinkStyle, color: '#2DB87A', fontWeight: 600 }}>
              Go to app
            </Link>
          ) : (
            <>
              <Link href="/login" onClick={() => setOpen(false)} style={mobileLinkStyle}>Sign in</Link>
              <Link
                href="/signup"
                onClick={() => setOpen(false)}
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: 'white',
                  textDecoration: 'none',
                  background: '#2DB87A',
                  padding: '10px 16px',
                  borderRadius: 7,
                  textAlign: 'center',
                  marginTop: 6,
                }}
              >
                Get started free
              </Link>
            </>
          )}
        </nav>
      )}
    </header>
  )
}

const navLinkStyle = {
  fontSize: 14,
  fontWeight: 500,
  color: '#4B5563',
  textDecoration: 'none',
  padding: '6px 14px',
} as const

const mobileLinkStyle = {
  fontSize: 15,
  fontWeight: 500,
  color: '#4B5563',
  textDecoration: 'none',
  padding: '10px 4px',
} as const

const ctaStyle = {
  fontSize: 14,
  fontWeight: 600,
  color: 'white',
  textDecoration: 'none',
  background: '#2DB87A',
  padding: '7px 18px',
  borderRadius: 7,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
} as const
