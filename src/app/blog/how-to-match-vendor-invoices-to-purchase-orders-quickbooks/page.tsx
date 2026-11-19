import type { Metadata } from 'next'
import Link from 'next/link'
import { blogPosts } from '../posts'
import { BreadcrumbJsonLd } from '../breadcrumb-jsonld'

const post = blogPosts.find(p => p.slug === 'how-to-match-vendor-invoices-to-purchase-orders-quickbooks')!
const canonicalPath = `/blog/${post.slug}`

export const metadata: Metadata = {
  title: post.title,
  description: post.description,
  keywords: [
    'match purchase orders to invoices quickbooks',
    'three-way match quickbooks',
    'quickbooks purchase order to bill',
    'compare vendor invoice to purchase order',
  ],
  alternates: { canonical: canonicalPath },
  openGraph: {
    title: post.title,
    description: post.description,
    url: canonicalPath,
    type: 'article',
    siteName: 'Purchasomatic',
    images: [{ url: '/logo-512.png', width: 512, height: 512, alt: 'Purchasomatic' }],
  },
}

const faqs = [
  {
    q: 'How do I link a purchase order to a bill in QuickBooks?',
    a: 'Open Enter Bills (Desktop) or Add Bill (Online), pick the vendor, and QuickBooks offers any open purchase orders for that vendor. Selecting one pulls its lines onto the bill and links the two, so the PO shows as received or closed once billed.',
  },
  {
    q: 'Does QuickBooks warn me when the invoice price is different from the PO?',
    a: 'Not in a way you can rely on. QuickBooks copies the PO lines onto the bill, and you can edit the amounts, but it does not highlight a price or quantity that differs from the PO. You have to compare them yourself.',
  },
  {
    q: 'Does Purchasomatic match invoices to purchase orders automatically?',
    a: 'Yes. When an invoice arrives, it is matched to an open PO by vendor and PO number. The bill is created linked to that PO, and price or quantity differences are flagged for a person to review. Bills with PO discrepancies are not auto-published.',
  },
  {
    q: 'Where do the purchase orders come from?',
    a: 'Forward the vendor PO confirmation to your Purchasomatic purchase order address. It reads the lines and creates the purchase order in QuickBooks, so there is an open PO ready to match when the invoice arrives.',
  },
  {
    q: 'Does it work with QuickBooks Desktop?',
    a: 'Yes. Purchasomatic supports both QuickBooks Online and QuickBooks Desktop.',
  },
]

export default function BlogPostPage() {
  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.description,
    author: { '@type': 'Person', name: 'Heather Dillon', jobTitle: 'Founder, Purchasomatic' },
    publisher: { '@type': 'Organization', name: 'Purchasomatic', url: 'https://www.purchasomatic.com', logo: { '@type': 'ImageObject', url: 'https://www.purchasomatic.com/logo-512.png' } },
    image: 'https://www.purchasomatic.com/logo-512.png',
    datePublished: post.date,
    dateModified: post.date,
    mainEntityOfPage: { '@type': 'WebPage', '@id': `https://www.purchasomatic.com${canonicalPath}` },
  }

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(f => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  }

  const pStyle = { marginBottom: 20, fontSize: 16, color: '#333' }
  const h2Style = { fontSize: 26, fontWeight: 700, color: '#1A3D2B', margin: '48px 0 16px' }

  return (
    <div style={{ minHeight: '100vh', background: 'white' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />
      <BreadcrumbJsonLd title={post.title} slug={post.slug} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />

      <div style={{ background: '#F0F9F4', borderBottom: '1px solid #D0E8D8', padding: '40px 24px 48px', textAlign: 'center' }}>
        <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 24, textDecoration: 'none' }}>
          <img src="/logo-28.png" alt="Purchasomatic" style={{ width: 28, height: 28 }} />
          <span style={{ fontSize: 15, fontWeight: 700, color: '#1A3D2B' }}>Purchasomatic</span>
        </Link>
        <div>
          <Link href="/blog" style={{ fontSize: 13, color: '#2DB87A', textDecoration: 'none' }}>
            &larr; Blog
          </Link>
        </div>
        <div
          style={{
            display: 'inline-block', background: '#2DB87A', color: 'white', fontSize: 12, fontWeight: 700,
            padding: '4px 12px', borderRadius: 4, letterSpacing: 0.5, textTransform: 'uppercase', margin: '16px 0',
          }}
        >
          QuickBooks Purchase Orders Guide
        </div>
        <h1 style={{ fontSize: 'clamp(26px, 4vw, 42px)', fontWeight: 800, color: '#1A3D2B', lineHeight: 1.2, maxWidth: 800, margin: '0 auto 16px' }}>
          {post.title}
        </h1>
        <p style={{ fontSize: 18, color: '#4A6B4A', maxWidth: 640, margin: '0 auto 20px' }}>
          How to check a vendor invoice against the purchase order in QuickBooks, what QuickBooks will and will not catch, and how to automate the comparison.
        </p>
        <p style={{ fontSize: 13, color: '#888' }}>
          By <strong style={{ color: '#555' }}>Heather Dillon</strong>, former HVAC office manager &middot; Founder of Purchasomatic
        </p>
      </div>

      <div style={{ maxWidth: 780, margin: '0 auto', padding: '48px 24px 80px', fontSize: 16, lineHeight: 1.7, color: '#333' }}>
        <p style={pStyle}>
          <strong>Short answer:</strong> in QuickBooks you link a vendor invoice to a purchase order by creating the bill from the open PO. QuickBooks links the two, but it does not tell you when the invoice price or quantity differs from what you ordered. That comparison is manual, unless a tool does it for you.
        </p>
        <p style={pStyle}>
          Checking invoices against POs matters because the invoice is what you pay. A price that crept up, a back-ordered item billed anyway, or a duplicate shipment all show up as an invoice that does not match the order.
        </p>

        <h2 style={h2Style}>How to turn a PO into a bill in QuickBooks</h2>
        <ol style={{ paddingLeft: 24, marginBottom: 20 }}>
          <li style={{ marginBottom: 8 }}>Open a new bill (Enter Bills in Desktop, Add Bill in Online) and choose the vendor.</li>
          <li style={{ marginBottom: 8 }}>QuickBooks lists the open purchase orders for that vendor. Select the one that matches the invoice.</li>
          <li style={{ marginBottom: 8 }}>The PO lines are copied onto the bill. Compare each line&rsquo;s quantity and unit price to the vendor&rsquo;s invoice and correct anything that differs.</li>
          <li style={{ marginBottom: 8 }}>Confirm the job on each line, then save. The PO is marked as billed.</li>
        </ol>

        <h2 style={h2Style}>What QuickBooks does not check</h2>
        <p style={pStyle}>
          Because the bill starts from the PO lines, it is easy to save a bill that quietly matches the PO while the real invoice says something else. QuickBooks will not flag a higher unit price, a short shipment, or an invoice total that does not equal the sum of the lines. Tracking what has actually arrived against each PO is also left to you.
        </p>

        <h2 style={h2Style}>Matching invoices to POs automatically</h2>
        <p style={pStyle}>
          Purchasomatic does the comparison when the invoice arrives:
        </p>
        <ol style={{ paddingLeft: 24, marginBottom: 20 }}>
          <li style={{ marginBottom: 8 }}>Forward vendor PO confirmations to your PO capture address. Purchasomatic creates the purchase order in QuickBooks.</li>
          <li style={{ marginBottom: 8 }}>Forward the vendor invoice to your bills address. Every line item is read from the PDF.</li>
          <li style={{ marginBottom: 8 }}>The invoice is matched to the open PO by vendor and PO number, and the bill is created linked to it.</li>
          <li style={{ marginBottom: 8 }}>Price or quantity differences are flagged on the bill, and a bill with a discrepancy is never auto-published. A person reviews it first.</li>
        </ol>
        <p style={pStyle}>
          Purchasomatic also has a receiving screen for marking what has actually arrived on each PO, line by line, so the answer to &ldquo;did that order come in?&rdquo; does not require a phone call.
        </p>

        <div style={{ background: '#1A3D2B', color: 'white', borderRadius: 12, padding: 36, margin: '48px 0', textAlign: 'center' }}>
          <h2 style={{ color: 'white', margin: '0 0 12px', fontSize: 24, fontWeight: 700 }}>Try it with your real invoices</h2>
          <p style={{ color: '#A8D8B8', marginBottom: 24 }}>25 free credits, no credit card. After that it is about 40 cents per invoice or PO.</p>
          <Link href="/signup" style={{ display: 'inline-block', background: '#2DB87A', color: 'white', padding: '14px 28px', borderRadius: 8, textDecoration: 'none', fontWeight: 700, fontSize: 16 }}>
            Start free trial
          </Link>
        </div>

        <p style={pStyle}>
          Related reading: <Link href="/blog/how-to-import-purchase-orders-into-quickbooks" style={{ color: '#2DB87A' }}>importing purchase orders into QuickBooks</Link>, <Link href="/blog/how-to-import-vendor-bills-quickbooks" style={{ color: '#2DB87A' }}>importing vendor bills</Link>, and <Link href="/pricing" style={{ color: '#2DB87A' }}>pricing</Link>.
        </p>

        <h2 style={h2Style}>Frequently Asked Questions</h2>
        <div style={{ margin: '48px 0' }}>
          {faqs.map(f => (
            <div key={f.q} style={{ borderBottom: '1px solid #E0E8E0', padding: '20px 0' }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#1A3D2B', marginBottom: 10 }}>{f.q}</div>
              <div style={{ fontSize: 15, color: '#444' }}>{f.a}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
