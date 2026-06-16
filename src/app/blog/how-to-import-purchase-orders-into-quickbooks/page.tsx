import type { Metadata } from 'next'
import Link from 'next/link'
import { blogPosts } from '../posts'

const post = blogPosts.find(p => p.slug === 'how-to-import-purchase-orders-into-quickbooks')!

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
            If you buy materials or equipment for jobs, you have two ways to get purchase orders into QuickBooks: type them in by hand, or have them entered automatically when the vendor sends you a confirmation. Here&rsquo;s both.
          </p>

          <Section title="Creating a purchase order manually in QuickBooks Online">
            <ol style={{ paddingLeft: 20 }}>
              <li style={{ marginBottom: 10 }}>Select <strong>+ New</strong>, then choose <strong>Purchase order</strong> under the Vendors column.</li>
              <li style={{ marginBottom: 10 }}>Choose the vendor you&rsquo;re ordering from. If you track classes or locations, set those too.</li>
              <li style={{ marginBottom: 10 }}>Add a line for each item or service you&rsquo;re ordering, with quantity and rate. If you use job costing, assign the customer/job to each line.</li>
              <li style={{ marginBottom: 10 }}>Save, and optionally email the PO to the vendor directly from QuickBooks.</li>
              <li style={{ marginBottom: 10 }}>When the invoice arrives, open the PO and select <strong>Copy to Bill</strong> so the bill links back to the original order — otherwise QuickBooks has no way to know the bill and the PO are related.</li>
            </ol>
            <p style={{ marginTop: 16 }}>
              This works fine for a handful of POs a month. It gets painful fast once you&rsquo;re juggling open orders across multiple jobs, trying to remember what&rsquo;s still outstanding, or chasing down which line items actually showed up.
            </p>
          </Section>

          <Section title="Where manual entry breaks down">
            <p>
              Every PO you create by hand is data you already have — it&rsquo;s sitting in the vendor&rsquo;s order confirmation email. Retyping it is pure overhead, and it&rsquo;s where job costing accuracy usually falls apart: a line gets coded to the wrong job, or a PO never gets linked to its bill, and now your job cost reports are wrong without anyone noticing.
            </p>
            <p style={{ marginTop: 12 }}>
              There&rsquo;s also no easy way to answer &ldquo;what did we order for this job, and has it shown up yet?&rdquo; without opening QuickBooks and cross-referencing manually.
            </p>
          </Section>

          <Section title="Importing purchase orders automatically">
            <p>
              Purchasomatic reads PO confirmation emails directly and creates the matching purchase order in QuickBooks — no typing. Here&rsquo;s the flow:
            </p>
            <ol style={{ paddingLeft: 20, marginTop: 12 }}>
              <li style={{ marginBottom: 10 }}>Forward (or have your vendor email) the PO confirmation to your Purchasomatic capture address.</li>
              <li style={{ marginBottom: 10 }}>Purchasomatic extracts every line item and creates the PO record in QuickBooks, with the job or customer already assigned.</li>
              <li style={{ marginBottom: 10 }}>When the actual invoice arrives later, Purchasomatic matches it to the open PO by vendor and PO number, links the bill automatically, and flags any price or quantity discrepancies for you to review.</li>
              <li style={{ marginBottom: 10 }}>A simple receiving checklist lets your team mark what arrived against each open PO — so &ldquo;did this show up yet&rdquo; is answerable without calling anyone.</li>
            </ol>
            <p style={{ marginTop: 16 }}>
              The bill that eventually lands in QuickBooks is already coded to the right GL account and job, linked to its PO, with the original PDF attached — the same result as the manual process above, minus the typing and the chance to get it wrong.
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
