'use client'

import { ConfirmProvider } from '@/components/confirm-dialog'
import type { ReactNode } from 'react'

export function DashboardProviders({ children }: { children: ReactNode }) {
  return <ConfirmProvider>{children}</ConfirmProvider>
}
