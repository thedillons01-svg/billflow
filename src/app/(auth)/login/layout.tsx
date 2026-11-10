import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Log in',
  description: 'Log in to your Purchasomatic account to review vendor bills and purchase orders captured from email and publish them to QuickBooks.',
  alternates: { canonical: '/login' },
  openGraph: { title: 'Log in to Purchasomatic', description: 'Review vendor bills and purchase orders captured from email and publish them to QuickBooks.', url: '/login', siteName: 'Purchasomatic', images: [{ url: '/logo-512.png', width: 512, height: 512, alt: 'Purchasomatic' }] },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
