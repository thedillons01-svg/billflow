'use client'

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useUnsavedPrompt } from '@/components/confirm-dialog'

type SaveFn = () => Promise<void>
type DirtyCtx = {
  isDirty: boolean
  setDirty: (v: boolean) => void
  saveFn: SaveFn | null
  registerSaveFn: (fn: SaveFn | null) => void
}

export const DirtyContext = createContext<DirtyCtx>({
  isDirty: false,
  setDirty: () => {},
  saveFn: null,
  registerSaveFn: () => {},
})

export function DirtyProvider({ children }: { children: ReactNode }) {
  const [isDirty, setDirty] = useState(false)
  const [saveFn, setSaveFn] = useState<SaveFn | null>(null)

  const registerSaveFn = useCallback((fn: SaveFn | null) => {
    setSaveFn(() => fn)
  }, [])

  useEffect(() => {
    if (!isDirty) return
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  return (
    <DirtyContext.Provider value={{ isDirty, setDirty, saveFn, registerSaveFn }}>
      {children}
    </DirtyContext.Provider>
  )
}

export function useDirty() {
  return useContext(DirtyContext)
}

export function useGuardedNavigate() {
  const { isDirty, setDirty, saveFn } = useDirty()
  const router = useRouter()
  const promptUnsaved = useUnsavedPrompt()
  return async (href: string) => {
    if (!isDirty) { router.push(href); return }
    const result = await promptUnsaved(!!saveFn)
    if (result === 'cancel') return
    if (result === 'save' && saveFn) await saveFn()
    setDirty(false)
    router.push(href)
  }
}
