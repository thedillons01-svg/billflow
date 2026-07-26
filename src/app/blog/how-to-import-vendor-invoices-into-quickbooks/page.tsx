import type { Metadata } from 'next'
import Link from 'next/link'
import { blogPosts } from '../posts'

const post = blogPosts.find(p => p.slug === 'how-to-import-vendor-invoices-into-quickbooks')!

export const metadata: Metadata = {
  title: post.title,
  description: post.description,
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <h2 style={{ fontSize: 19, fontWeight: 600, color: '#111827', marginBottom: 12, letterSpacing: '-0.01em' }}>
        {title}
      </h2>
      {children}
    </div>
  )
}

export default function BlogPostPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    dateModified: post.date,
    author: { '@type': 'Person', name: 'Heather Dillon' },
    publisher: { '@type': 'Organization', name: 'Purchasomatic' },
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F9FAFB' }}>
      {/* eslint-disable-next-line @next/next/no-sync-scripts */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '48px 24px 80px' }}>

        <div style={{ marginBottom: 40 }}>
          <Link
            href="/"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 32, textDecoration: 'none' }}
          >
            <img src="/logo-28.png" alt="Purchasomatic" style={{ width: 28, height: 28 }} />
            <span style={{ fontSize: 15, fontWeight: 700, color: '#1A3D2B' }}>Purchasomatic</span>
          </Link>
          <Link href="/blog" style={{ fontSize: 13, color: '#2DB87A', textDecoration: 'none', display: 'inline-block', marginBottom: 16 }}>
            &larr; Blog
          </Link>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#111827', marginBottom: 8, letterSpacing: '-0.02em' }}>
            {post.title}
          </h1>
          <p style={{ fontSize: 14, color: '#6B7280' }}>
            Published {new Date(post.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        <div style={{ background: 'white', borderRadius: 12, border: '1px solid #E5E7EB', padding: '40px 48px', fontSize: 15, lineHeight: 1.7, color: '#374151' }}>

          <p style={{ marginBottom: 24 }}>
            When a vendor invoice for materials or equipment lands in your inbox, it needs to become a bill in QuickBooks — coded to the right expense account, and usually to the right job. You can type it in by hand, or have it entered automatically the moment the invoice arrives. Here&rsquo;s both.
          </p>

          <Section title="Entering a vendor bill manually in QuickBooks Online">
            <ol style={{ paddingLeft: 20 }}>
              <li style={{ marginBottom: 10 }}>Select <strong>+ New</strong>, then choose <strong>Bill</strong> under the Vendors column.</li>
              <li style={{ marginBottom: 10 }}>Choose the vendor, and enter the bill date, due date, and invoice/reference number from the PDF.</li>
              <li style={{ marginBottom: 10 }}>Add a line for every item or charge on the invoice — including tax lines — with the correct GL account. If you job cost, assign the customer/job to each line.</li>
              <li style={{ marginBottom: 10 }}>Check that your line items add up to the invoice total before saving.</li>
              <li style={{ marginBottom: 10 }}>Save, and attach the PDF to the bill record so it&rsquo;s there if you need to reference it later.</li>
            </ol>
            <p style={{ marginTop: 16 }}>
              Fine for a handful of invoices a week. It stops being fine once you&rsquo;re keying in dozens of line items a day across multiple vendors, each with its own invoice layout.
            </p>
          </Section>

          <Section title="Where manual entry breaks down">
            <p>
              Every invoice you type in by hand is data that was already typed once, by the vendor. Retyping it costs time and is where mistakes creep in — a line coded to the wrong GL account, a job left off, a typo in a quantity that throws off the total. Scanned or multi-invoice PDFs make it worse, since there&rsquo;s no clean text to copy from at all.
            </p>
            <p style={{ marginTop: 12 }}>
              It also means someone has to sit down and process invoices as a dedicated task, instead of them just being handled.
            </p>
          </Section>

          <Section title="Importing vendor invoices automatically">
            <p>
              Purchasomatic reads invoice emails directly and extracts every line item into a QuickBooks bill — no typing. Here&rsquo;s the flow:
            </p>
            <ol style={{ paddingLeft: 20, marginTop: 12 }}>
              <li style={{ marginBottom: 10 }}>Forward (or have vendors email) invoices to your Purchasomatic capture address.</li>
              <li style={{ marginBottom: 10 }}>OCR extracts every line item, including tax lines, and checks that they add up to the invoice total.</li>
              <li style={{ marginBottom: 10 }}>Purchasomatic matches the invoice to a job automatically when a PO or reference number is present, and applies GL accounts from vendor rules you&rsquo;ve set once.</li>
              <li style={{ marginBottom: 10 }}>Once a vendor has a track record of clean, accurate extractions, Purchasomatic can publish bills straight to QuickBooks without anyone touching them — with the original PDF attached.</li>
            </ol>
            <p style={{ marginTop: 16 }}>
              You still see and can correct anything before it publishes — the difference is nobody&rsquo;s manually retyping invoices that were already typed once by the vendor.
            </p>
          </Section>

          <div style={{ marginTop: 8, paddingTop: 24, borderTop: '1px solid #E5E7EB', textAlign: 'center' }}>
            <Link
              href="/signup"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                background: '#2DB87A', color: 'white', fontSize: 14, fontWeight: 600,
                padding: '11px 24px', borderRadius: 8, textDecoration: 'none',
              }}
            >
              Try Purchasomatic free
              <i className="ti ti-arrow-right" style={{ fontSize: 14 }} />
            </Link>
            <p style={{ marginTop: 12, fontSize: 13, color: '#9CA3AF' }}>25 free trial credits · No credit card required</p>
          </div>
        </div>
      </div>
    </div>
  )
}
