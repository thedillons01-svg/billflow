import type { MetadataRoute } from 'next'

const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.purchasomatic.com'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/',
        '/home',
        '/bills',
        '/purchase-orders',
        '/vendors',
        '/jobs',
        '/receiving',
        '/settings',
        '/billing',
        '/activity',
        '/exports',
        '/trash',
        '/onboarding',
        '/reset-password',
      ],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
