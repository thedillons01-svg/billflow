'use client'

import type { ReactNode, CSSProperties } from 'react'
import { useGuardedNavigate } from '@/components/unsaved-guard'

// Same nav-guard behavior as sidebar links, for in-page links that may sit above unsaved changes.
export function GuardedLink({ href, style, className, children }: { href: string; style?: CSSProperties; className?: string; children: ReactNode }) {
  const navigate = useGuardedNavigate()
  return (
    <button
      type="button"
      onClick={() => navigate(href)}
      className={className}
      style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', font: 'inherit', color: 'inherit', ...style }}
    >
      {children}
    </button>
  )
}
