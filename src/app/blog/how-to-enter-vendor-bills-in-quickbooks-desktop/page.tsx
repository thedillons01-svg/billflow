import type { Metadata } from 'next'
import Link from 'next/link'
import { blogPosts } from '../posts'
import { BreadcrumbJsonLd } from '../breadcrumb-jsonld'

const post = blogPosts.find(p => p.slug === 'how-to-enter-vendor-bills-in-quickbooks-desktop')!
const canonicalPath = `/blog/${post.slug}`

export const metadata: Metadata = {
  title: post.title,
  description: post.description,
  keywords: [
    'enter vendor bills quickbooks desktop',
    'quickbooks desktop enter bills',
    'import vendor invoices quickbooks desktop',
    'quickbooks desktop bill entry automation',
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
    q: 'Can QuickBooks Desktop read a PDF invoice and create a bill?',
    a: 'Not on its own. QuickBooks Desktop has no built-in PDF invoice reader, so each bill is typed in by hand or created by a separate tool that reads the PDF for you.',
  },
  {
    q: 'Can I put a job on each line of a bill in QuickBooks Desktop?',
    a: 'Yes. On the Expenses and Items tabs of the Enter Bills window, each line has a Customer:Job column. Putting the job on every line is what makes the cost show up in job reports.',
  },
  {
    q: 'Does Purchasomatic work with QuickBooks Desktop?',
    a: 'Yes. Purchasomatic supports both QuickBooks Online and QuickBooks Desktop. For Desktop, bills are sent through the Intuit Web Connector, which checks for new bills every few minutes. Desktop cannot receive PDF attachments through this route, so the PDF stays in Purchasomatic alongside the bill.',
  },
  {
    q: 'Does QuickBooks need to be open for bills to arrive?',
    a: 'The Intuit Web Connector runs on the computer where your QuickBooks Desktop company file is kept, and QuickBooks needs to be able to open the company file for the connector to deliver bills. Purchasomatic notifies you if the connector stops checking in.',
  },
  {
    q: 'Does it create jobs in my QuickBooks company file?',
    a: 'No. Purchasomatic only matches bills to jobs that already exist in QuickBooks. It never creates job records.',
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
          QuickBooks Desktop Guide
        </div>
        <h1 style={{ fontSize: 'clamp(26px, 4vw, 42px)', fontWeight: 800, color: '#1A3D2B', lineHeight: 1.2, maxWidth: 800, margin: '0 auto 16px' }}>
          {post.title}
        </h1>
        <p style={{ fontSize: 18, color: '#4A6B4A', maxWidth: 640, margin: '0 auto 20px' }}>
          How to enter a vendor bill in QuickBooks Desktop by hand, where the time goes, and how to get PDF invoices into Desktop without typing them.
        </p>
        <p style={{ fontSize: 13, color: '#888' }}>
          By <strong style={{ color: '#555' }}>Heather Dillon</strong>, former HVAC office manager &middot; Founder of Purchasomatic
        </p>
      </div>

      <div style={{ maxWidth: 780, margin: '0 auto', padding: '48px 24px 80px', fontSize: 16, lineHeight: 1.7, color: '#333' }}>
        <p style={pStyle}>
          <strong>Short answer:</strong> in QuickBooks Desktop you enter a vendor bill from <strong>Vendors &rarr; Enter Bills</strong>, one bill at a time. Desktop does not read PDF invoices for you. If you want bills created from PDFs without typing, you need a tool that reads the invoice and sends it into your company file.
        </p>
        <p style={pStyle}>
          Most of what you find online about importing bills is written for QuickBooks Online. Desktop works differently, so here is what it actually involves.
        </p>

        <h2 style={h2Style}>How to enter a vendor bill in QuickBooks Desktop</h2>
        <ol style={{ paddingLeft: 24, marginBottom: 20 }}>
          <li style={{ marginBottom: 8 }}>Go to <strong>Vendors &rarr; Enter Bills</strong>.</li>
          <li style={{ marginBottom: 8 }}>Choose the vendor, then fill in the bill date, reference number (the vendor&rsquo;s invoice number) and amount due. Check the terms and due date.</li>
          <li style={{ marginBottom: 8 }}>Use the <strong>Expenses</strong> tab to code each line to an account, or the <strong>Items</strong> tab if the bill is for inventory or item-based purchases.</li>
          <li style={{ marginBottom: 8 }}>In the <strong>Customer:Job</strong> column, pick the job each line belongs to. Leave it blank for shop stock and overhead.</li>
          <li style={{ marginBottom: 8 }}>If you have an open purchase order for this vendor, QuickBooks offers to pull it in, which links the bill to the PO.</li>
          <li style={{ marginBottom: 8 }}>Save the bill. Attach the PDF separately if you want it kept somewhere.</li>
        </ol>

        <h2 style={h2Style}>Where the time goes</h2>
        <p style={pStyle}>
          Typing is the smaller cost. The slower part is deciding: which job does this belong to, which account does this line go to, does the price match what was ordered, and is this a duplicate of an invoice already entered. For a vendor invoice with 15 lines, each of those questions is asked 15 times.
        </p>
        <p style={pStyle}>
          Job costing only works if the job is on every line, so skipping that step means your job reports are wrong. That is why a quick &ldquo;just enter it&rdquo; approach tends to fall apart for contractors.
        </p>

        <h2 style={h2Style}>Can you bulk-import bills into QuickBooks Desktop?</h2>
        <p style={pStyle}>
          Desktop can import data from spreadsheets and IIF files, and there are third-party importers built on that. They all share one limitation: someone has to prepare the data first. A PDF is not data until somebody types it into a template, so you have moved the typing, not removed it.
        </p>

        <h2 style={h2Style}>Getting PDF invoices into Desktop automatically</h2>
        <p style={pStyle}>
          Purchasomatic reads vendor invoices from email and sends finished bills into QuickBooks Desktop through the Intuit Web Connector:
        </p>
        <ol style={{ paddingLeft: 24, marginBottom: 20 }}>
          <li style={{ marginBottom: 8 }}>Forward vendor invoices to your company&rsquo;s Purchasomatic bills address.</li>
          <li style={{ marginBottom: 8 }}>Every line item is read from the PDF, including scanned invoices.</li>
          <li style={{ marginBottom: 8 }}>The bill is matched to a job that already exists in your QuickBooks company file, and to an open purchase order, with price and quantity mismatches flagged.</li>
          <li style={{ marginBottom: 8 }}>You review and approve it, or turn on auto-publish for a vendor once it has had 5 invoices processed. Unusual bills are still held for a person.</li>
          <li style={{ marginBottom: 8 }}>The Web Connector delivers the bill to QuickBooks Desktop the next time it checks in, usually within a few minutes.</li>
        </ol>
        <p style={pStyle}>
          Two Desktop-specific notes: Desktop cannot receive PDF attachments this way, so the PDF is kept in Purchasomatic with the bill; and the connector has to be running on the computer that holds your company file. If it stops checking in, you are notified.
        </p>

        <div style={{ background: '#1A3D2B', color: 'white', borderRadius: 12, padding: 36, margin: '48px 0', textAlign: 'center' }}>
          <h2 style={{ color: 'white', margin: '0 0 12px', fontSize: 24, fontWeight: 700 }}>Try it with your real invoices</h2>
          <p style={{ color: '#A8D8B8', marginBottom: 24 }}>25 free credits, no credit card. After that it is about 40 cents per invoice or PO.</p>
          <Link href="/signup" style={{ display: 'inline-block', background: '#2DB87A', color: 'white', padding: '14px 28px', borderRadius: 8, textDecoration: 'none', fontWeight: 700, fontSize: 16 }}>
            Start free trial
          </Link>
        </div>

        <p style={pStyle}>
          Related reading: <Link href="/blog/how-to-import-vendor-bills-quickbooks" style={{ color: '#2DB87A' }}>importing vendor bills into QuickBooks Online</Link>, <Link href="/blog/how-to-import-purchase-orders-into-quickbooks" style={{ color: '#2DB87A' }}>importing purchase orders</Link>, and <Link href="/pricing" style={{ color: '#2DB87A' }}>pricing</Link>.
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
