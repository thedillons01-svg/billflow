import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Log in',
  description: 'Log in to your Purchasomatic account to review vendor bills and purchase orders captured from email and publish them to QuickBooks.',
  alternates: { canonical: '/login' },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
