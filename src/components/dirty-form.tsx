'use client'

import { createContext, useContext, useState, useTransition, useEffect, useCallback, useId, useRef, type ReactNode } from 'react'
import { useDirty } from '@/components/unsaved-guard'

type Ctx = { dirty: boolean; pending: boolean }
const DirtyCtx = createContext<Ctx>({ dirty: false, pending: false })

type GroupCtx = {
  register: (id: string, submit: () => Promise<void>) => void
  unregister: (id: string) => void
  markDirty: (id: string, dirty: boolean) => void
} | null
const GroupContext = createContext<GroupCtx>(null)

// Wraps a page with multiple independent DirtyForms (e.g. Settings) so the page-wide
// nav guard sees them as one unit and "Save and leave" saves every dirty form, not just one.
export function DirtyFormGroup({ children }: { children: ReactNode }) {
  const { setDirty, registerSaveFn } = useDirty()
  const entriesRef = useRef<Map<string, { dirty: boolean; submit: () => Promise<void> }>>(new Map())

  const recompute = useCallback(() => {
    setDirty([...entriesRef.current.values()].some(e => e.dirty))
  }, [setDirty])

  const register = useCallback((id: string, submit: () => Promise<void>) => {
    entriesRef.current.set(id, { dirty: false, submit })
  }, [])

  const unregister = useCallback((id: string) => {
    entriesRef.current.delete(id)
    recompute()
  }, [recompute])

  const markDirty = useCallback((id: string, dirty: boolean) => {
    const entry = entriesRef.current.get(id)
    if (entry) entry.dirty = dirty
    recompute()
  }, [recompute])

  useEffect(() => {
    registerSaveFn(async () => {
      const dirtyEntries = [...entriesRef.current.values()].filter(e => e.dirty)
      await Promise.all(dirtyEntries.map(e => e.submit()))
    })
    return () => {
      registerSaveFn(null)
      setDirty(false)
    }
  }, [registerSaveFn, setDirty])

  return (
    <GroupContext.Provider value={{ register, unregister, markDirty }}>
      {children}
    </GroupContext.Provider>
  )
}

export function DirtyForm({
  action,
  children,
}: {
  action: (fd: FormData) => Promise<void>
  children: ReactNode
}) {
  const id = useId()
  const group = useContext(GroupContext)
  const formRef = useRef<HTMLFormElement>(null)
  const [dirty, setDirty] = useState(false)
  const [isPending, startTransition] = useTransition()

  const submit = useCallback(() => new Promise<void>(resolve => {
    startTransition(async () => {
      if (formRef.current) await action(new FormData(formRef.current))
      setDirty(false)
      resolve()
    })
  }), [action])

  useEffect(() => {
    if (!group) return
    group.register(id, submit)
    return () => group.unregister(id)
  }, [group, id, submit])

  useEffect(() => {
    group?.markDirty(id, dirty)
  }, [group, id, dirty])

  // Standalone fallback (no group) — keep the native warning as a safety net for tab close/refresh.
  useEffect(() => {
    if (group || !dirty) return
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty, group])

  return (
    <DirtyCtx.Provider value={{ dirty, pending: isPending }}>
      <form
        ref={formRef}
        action={(fd: FormData) => {
          startTransition(async () => {
            await action(fd)
            setDirty(false)
          })
        }}
        onChange={() => setDirty(true)}
      >
        {children}
      </form>
    </DirtyCtx.Provider>
  )
}

export function SaveButton({ children = 'Save' }: { children?: ReactNode }) {
  const { dirty, pending } = useContext(DirtyCtx)
  const active = dirty && !pending
  return (
    <button
      type="submit"
      disabled={!active}
      style={{
        background: active ? '#2DB87A' : '#D1D5DB',
        color: 'white',
        borderRadius: 6,
        padding: '7px 16px',
        fontSize: 13,
        fontWeight: 500,
        border: 'none',
        cursor: active ? 'pointer' : 'default',
        transition: 'background 0.15s',
        opacity: pending ? 0.7 : 1,
      }}
    >
      {pending ? 'Saving…' : children}
    </button>
  )
}
