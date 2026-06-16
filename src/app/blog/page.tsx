import type { Metadata } from 'next'
import Link from 'next/link'
import { blogPosts } from './posts'

export const metadata: Metadata = {
  title: 'Blog',
  description: 'Guides for importing, automating, and tracking purchase orders and invoices in QuickBooks.',
}

export default function BlogIndexPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#F9FAFB' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '48px 24px 80px' }}>

        <div style={{ marginBottom: 40 }}>
          <Link
            href="/"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 32, textDecoration: 'none' }}
          >
            <img src="/logo-28.png" alt="Purchasomatic" style={{ width: 28, height: 28 }} />
            <span style={{ fontSize: 15, fontWeight: 700, color: '#1A3D2B' }}>Purchasomatic</span>
          </Link>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#111827', marginBottom: 8 }}>Blog</h1>
          <p style={{ fontSize: 14, color: '#6B7280' }}>Guides for purchase orders, invoices, and QuickBooks.</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {blogPosts.map(post => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              style={{
                display: 'block',
                background: 'white',
                borderRadius: 12,
                border: '1px solid #E5E7EB',
                padding: '24px 28px',
                textDecoration: 'none',
              }}
            >
              <h2 style={{ fontSize: 18, fontWeight: 600, color: '#111827', marginBottom: 6, letterSpacing: '-0.01em' }}>
                {post.title}
              </h2>
              <p style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.6 }}>{post.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
