'use client'

import { ConfirmProvider } from '@/components/confirm-dialog'
import { DirtyProvider } from '@/components/unsaved-guard'
import type { ReactNode } from 'react'

export function DashboardProviders({ children }: { children: ReactNode }) {
  return (
    <ConfirmProvider>
      <DirtyProvider>
        {children}
      </DirtyProvider>
    </ConfirmProvider>
  )
}
