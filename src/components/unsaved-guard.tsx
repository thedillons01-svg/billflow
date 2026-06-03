'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useConfirm } from '@/components/confirm-dialog'

type DirtyCtx = { isDirty: boolean; setDirty: (v: boolean) => void }

export const DirtyContext = createContext<DirtyCtx>({ isDirty: false, setDirty: () => {} })

export function DirtyProvider({ children }: { children: ReactNode }) {
  const [isDirty, setDirty] = useState(false)

  useEffect(() => {
    if (!isDirty) return
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  return (
    <DirtyContext.Provider value={{ isDirty, setDirty }}>
      {children}
    </DirtyContext.Provider>
  )
}

export function useDirty() {
  return useContext(DirtyContext)
}

export function useGuardedNavigate() {
  const { isDirty, setDirty } = useDirty()
  const router = useRouter()
  const confirm = useConfirm()
  return async (href: string) => {
    if (!isDirty || await confirm('You have unsaved changes. If you leave now your changes will be lost.')) {
      setDirty(false)
      router.push(href)
    }
  }
}
