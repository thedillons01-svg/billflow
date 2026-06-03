'use client'

import { createContext, useContext, useCallback, useState, type ReactNode } from 'react'

type ConfirmState = { message: string; resolve: (v: boolean) => void } | null
type ConfirmFn = (message: string) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn>(async () => true)

export function useConfirm(): ConfirmFn {
  return useContext(ConfirmContext)
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ConfirmState>(null)

  const confirm = useCallback((message: string): Promise<boolean> =>
    new Promise(resolve => setState({ message, resolve })), [])

  function handle(value: boolean) {
    state?.resolve(value)
    setState(null)
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(15,23,42,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onClick={() => handle(false)}
        >
          <div
            style={{
              background: 'white', borderRadius: 10, padding: '24px',
              maxWidth: 400, width: '100%', margin: '0 16px',
              boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                background: '#FEF3C7',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <i className="ti ti-alert-triangle" style={{ fontSize: 17, color: '#D97706' }} />
              </div>
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: '#0F172A', marginBottom: 4 }}>
                  Unsaved changes
                </p>
                <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.5 }}>
                  {state.message}
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => handle(false)}
                style={{
                  padding: '7px 14px', fontSize: 13, fontWeight: 500,
                  border: '0.5px solid #CBD5E1', borderRadius: 6,
                  background: 'white', color: '#475569', cursor: 'pointer',
                }}
              >
                Keep editing
              </button>
              <button
                onClick={() => handle(true)}
                style={{
                  padding: '7px 14px', fontSize: 13, fontWeight: 500,
                  border: 'none', borderRadius: 6,
                  background: '#DC2626', color: 'white', cursor: 'pointer',
                }}
              >
                Leave without saving
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}
