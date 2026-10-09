import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sign up free: 25 trial credits, no card',
  description: 'Create a Purchasomatic account and try automatic vendor invoice and purchase order capture for QuickBooks with 25 free credits. No credit card required.',
  alternates: { canonical: '/signup' },
  openGraph: { title: 'Sign up for Purchasomatic', description: 'Try automatic vendor invoice and PO capture for QuickBooks with 25 free credits. No card required.', url: '/signup', siteName: 'Purchasomatic', images: [{ url: '/logo-512.png', width: 512, height: 512, alt: 'Purchasomatic' }] },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
