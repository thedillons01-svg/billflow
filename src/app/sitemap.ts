import type { MetadataRoute } from 'next'
import { blogPosts } from './blog/posts'

const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.purchasomatic.com'

export default function sitemap(): MetadataRoute.Sitemap {
  // Fixed dates so lastModified only changes when content actually does.
  const marketingUpdated = new Date('2026-09-30')
  const legalUpdated = new Date('2026-09-30')
  return [
    { url: baseUrl, lastModified: marketingUpdated, changeFrequency: 'weekly', priority: 1 },
    { url: `${baseUrl}/login`, lastModified: marketingUpdated, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${baseUrl}/signup`, lastModified: marketingUpdated, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${baseUrl}/pricing`, lastModified: marketingUpdated, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${baseUrl}/help`, lastModified: marketingUpdated, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${baseUrl}/blog`, lastModified: marketingUpdated, changeFrequency: 'weekly', priority: 0.6 },
    ...blogPosts.map(post => ({
      url: `${baseUrl}/blog/${post.slug}`,
      lastModified: new Date(post.date),
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
    { url: `${baseUrl}/privacy`, lastModified: legalUpdated, changeFrequency: 'yearly', priority: 0.1 },
    { url: `${baseUrl}/terms`, lastModified: legalUpdated, changeFrequency: 'yearly', priority: 0.1 },
  ]
}
