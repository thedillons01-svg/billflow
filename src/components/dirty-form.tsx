'use client'

import { createContext, useContext, useState, useTransition, type ReactNode } from 'react'

type Ctx = { dirty: boolean; pending: boolean }
const DirtyCtx = createContext<Ctx>({ dirty: false, pending: false })

export function DirtyForm({
  action,
  children,
}: {
  action: (fd: FormData) => Promise<void>
  children: ReactNode
}) {
  const [dirty, setDirty] = useState(false)
  const [isPending, startTransition] = useTransition()

  return (
    <DirtyCtx.Provider value={{ dirty, pending: isPending }}>
      <form
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
