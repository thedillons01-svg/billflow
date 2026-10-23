import type { MetadataRoute } from 'next'

const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.purchasomatic.com'

// Explicitly welcome search and AI-answer crawlers on the public marketing pages;
// app and account routes stay off limits for everyone.
const aiCrawlers = ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'PerplexityBot', 'ClaudeBot', 'Claude-SearchBot', 'Google-Extended']

export default function robots(): MetadataRoute.Robots {
  const disallow = [
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
    '/forgot-password',
    '/admin',
  ]
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow },
      { userAgent: aiCrawlers, allow: '/', disallow },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
