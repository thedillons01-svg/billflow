import type { Metadata } from 'next'
import Link from 'next/link'
import { blogPosts } from '../posts'

const post = blogPosts.find(p => p.slug === 'how-to-import-vendor-bills-quickbooks')!
const canonicalPath = `/blog/${post.slug}`

export const metadata: Metadata = {
  title: post.title,
  description: post.description,
  keywords: [
    'import vendor bills quickbooks',
    'import vendor invoices quickbooks online',
    'quickbooks vendor bill import',
    'AP automation quickbooks',
    'vendor invoice automation',
  ],
  alternates: { canonical: canonicalPath },
  openGraph: {
    title: post.title,
    description: 'There are 3 ways to get vendor invoices into QuickBooks — but only one does job matching automatically.',
    url: canonicalPath,
    type: 'article',
  },
}

const faqs = [
  {
    q: 'Can I import vendor bills into QuickBooks Online for free?',
    a: 'Yes — QuickBooks Online includes a native bill upload feature at no extra cost. Go to Expenses → Bills → Add Bill → Upload multiple bills. The limitation is that it doesn’t assign invoices to jobs or classes automatically. Purchasomatic offers 25 free invoices with full job matching, also at no cost to start.',
  },
  {
    q: 'Does QuickBooks Online support vendor invoice automation?',
    a: 'QuickBooks Online has basic bill capture via email forwarding and PDF upload, but does not automate job matching or class assignment. For full automation including job matching, you need a third-party integration like Purchasomatic.',
  },
  {
    q: 'What is the difference between Transaction Pro Importer and Purchasomatic?',
    a: 'Transaction Pro Importer is a bulk import tool designed for migrating data from spreadsheets into QuickBooks — typically used for historical data or data from other systems. Purchasomatic is built for ongoing daily invoice processing: it reads PDF invoices automatically, matches them to the right job, and pushes them into QuickBooks without any spreadsheet preparation.',
  },
  {
    q: 'Does Purchasomatic work with QuickBooks Desktop?',
    a: 'Yes. Purchasomatic supports both QuickBooks Online and QuickBooks Desktop.',
  },
  {
    q: 'How does Purchasomatic know which job to assign an invoice to?',
    a: 'Purchasomatic connects to your QuickBooks and reads your job list. It then matches incoming invoices to jobs based on vendor history, invoice descriptions, and your patterns over time. Every match is reviewable before it posts — you’re always in control.',
  },
  {
    q: 'What vendors does Purchasomatic work with?',
    a: 'Any vendor that sends a PDF invoice — Ferguson, Winsupply, Johnstone Supply, Hajoca, Gensco, and any other supplier. If they email a PDF, Purchasomatic can process it.',
  },
]

function OptionCard({
  num,
  numColor,
  title,
  sub,
  verdict,
  verdictColor,
  best,
  children,
}: {
  num: string
  numColor: string
  title: string
  sub: string
  verdict: string
  verdictColor: { bg: string; color: string }
  best?: boolean
  children: React.ReactNode
}) {
  return (
    <div
      style={{
        border: `2px solid ${best ? '#2DB87A' : '#E0E8E0'}`,
        background: best ? '#F0FAF5' : 'transparent',
        borderRadius: 12,
        padding: 24,
        margin: '24px 0',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <div
          style={{
            background: numColor, color: 'white', width: 32, height: 32, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0,
          }}
        >
          {num}
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#1A2A1A' }}>{title}</div>
          <div style={{ fontSize: 13, color: '#888', fontWeight: 400 }}>{sub}</div>
        </div>
      </div>
      <span
        style={{
          display: 'inline-block', fontSize: 12, fontWeight: 700, padding: '3px 10px',
          borderRadius: 4, marginBottom: 12, background: verdictColor.bg, color: verdictColor.color,
        }}
      >
        {verdict}
      </span>
      {children}
    </div>
  )
}

export default function BlogPostPage() {
  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.description,
    author: { '@type': 'Person', name: 'Heather Dillon', jobTitle: 'Founder, Purchasomatic' },
    publisher: { '@type': 'Organization', name: 'Purchasomatic', url: 'https://www.purchasomatic.com' },
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
          QuickBooks Guide
        </div>
        <h1 style={{ fontSize: 'clamp(26px, 4vw, 42px)', fontWeight: 800, color: '#1A3D2B', lineHeight: 1.2, maxWidth: 800, margin: '0 auto 16px' }}>
          {post.title}
        </h1>
        <p style={{ fontSize: 18, color: '#4A6B4A', maxWidth: 640, margin: '0 auto 20px' }}>
          There are three ways to get vendor invoices into QuickBooks — but only one automatically matches them to the right job. Here&rsquo;s what each option actually does, and which is right for your trades business.
        </p>
        <p style={{ fontSize: 13, color: '#888' }}>
          By <strong style={{ color: '#555' }}>Heather Dillon</strong>, former HVAC office manager &middot; Founder of Purchasomatic
        </p>
      </div>

      <div style={{ maxWidth: 780, margin: '0 auto', padding: '48px 24px 80px', fontSize: 16, lineHeight: 1.7, color: '#333' }}>

        <p style={pStyle}>
          If you&rsquo;re an HVAC contractor, plumber, electrician, or roofer running QuickBooks Online, you already know the problem: vendor invoices pile up every week from Ferguson, Winsupply, Johnstone, and every other supplier you use. Someone has to get those into QuickBooks — on the right job, with the right class — before your job cost reports mean anything.
        </p>
        <p style={pStyle}>The good news: you have options. The bad news: most of them still leave the hard part to you.</p>

        <h2 style={h2Style}>Option 1 — QuickBooks Native Bill Upload</h2>
        <OptionCard
          num="1" numColor="#1A3D2B" title="QuickBooks Built-In Upload" sub="No extra cost · Built into QBO"
          verdict="Limited" verdictColor={{ bg: '#FEE2E2', color: '#991B1B' }}
        >
          <p style={pStyle}>
            QuickBooks Online has a native feature that lets you upload PDF invoice files. Go to <strong>Expenses &rarr; Bills &rarr; Add Bill &rarr; Upload multiple bills</strong> and drag your PDFs in.
          </p>
          <p style={pStyle}>QBO will attempt to read the vendor name and invoice amount from the PDF. That&rsquo;s where it stops.</p>
          <p style={pStyle}><strong>What it doesn&rsquo;t do:</strong> It doesn&rsquo;t assign the invoice to a job. It doesn&rsquo;t set the class. It doesn&rsquo;t check it against a purchase order. All of that still has to be done manually, one invoice at a time.</p>
          <p style={{ ...pStyle, marginBottom: 0 }}><strong>Bottom line:</strong> Good for occasional invoices. Not practical if you&rsquo;re processing 20+ invoices a week across multiple jobs.</p>
        </OptionCard>

        <h2 style={h2Style}>Option 2 — Bulk Import Tools (Transaction Pro, SaasAnt)</h2>
        <OptionCard
          num="2" numColor="#1A3D2B" title="Transaction Pro Importer / SaasAnt Transactions" sub="$30–$50/mo · QuickBooks App Store"
          verdict="Works for bulk data migration" verdictColor={{ bg: '#FEF9C3', color: '#854D0E' }}
        >
          <p style={pStyle}>Tools like Transaction Pro Importer and SaasAnt let you import vendor bills from a spreadsheet — typically a CSV or Excel file formatted to their template.</p>
          <p style={pStyle}>These tools are great if you&rsquo;re migrating historical data into QuickBooks, or if your vendors send invoices as data exports. For ongoing daily invoice processing from PDF invoices, they&rsquo;re not designed for that workflow.</p>
          <p style={pStyle}><strong>What you have to do:</strong> Manually prepare a spreadsheet with each invoice&rsquo;s data, including the correct job number and class for each line item. Then upload it.</p>
          <p style={pStyle}><strong>The problem for contractors:</strong> The &ldquo;correct job number&rdquo; step is exactly what costs you time. You still have to look up which job each invoice belongs to, enter it in the spreadsheet, and then import. You&rsquo;ve eliminated the typing but not the thinking — or the time.</p>
          <p style={{ ...pStyle, marginBottom: 0 }}><strong>Bottom line:</strong> Best for historical data migration. Not the right tool for daily vendor invoice processing.</p>
        </OptionCard>

        <div style={{ background: '#F0FAF5', border: '1px solid #2DB87A', borderRadius: 8, padding: '20px 24px', margin: '32px 0', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <p style={{ margin: 0, flex: 1, minWidth: 200, fontSize: 15 }}>
            If job matching is the bottleneck, Purchasomatic handles that step automatically — no spreadsheet prep required.
          </p>
          <Link href="/signup" style={{ display: 'inline-block', background: '#2DB87A', color: 'white', padding: '10px 20px', borderRadius: 6, textDecoration: 'none', fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap' }}>
            Try free — 25 invoices
          </Link>
        </div>

        <h2 style={h2Style}>Option 3 — Automated Invoice Processing with Job Matching</h2>
        <OptionCard
          num="3" numColor="#2DB87A" title="Purchasomatic" sub="Built for HVAC and trades contractors · Free trial"
          verdict="Best for contractors with job costing" verdictColor={{ bg: '#D1FAE5', color: '#065F46' }} best
        >
          <p style={pStyle}>Purchasomatic is built specifically for HVAC and trades contractors who use QuickBooks Online or Desktop and need their vendor invoices to land on the right job — automatically.</p>
          <p style={pStyle}>Here&rsquo;s what happens when you forward an invoice to Purchasomatic:</p>
          <ol style={{ paddingLeft: 24, marginBottom: 20 }}>
            <li style={{ marginBottom: 8, fontSize: 16 }}><strong>It reads the PDF automatically</strong> — vendor name, line items, amounts, invoice number</li>
            <li style={{ marginBottom: 8, fontSize: 16 }}><strong>It matches the invoice to the right job in QuickBooks</strong> — based on your job list, vendor history, and invoice descriptions</li>
            <li style={{ marginBottom: 8, fontSize: 16 }}><strong>It assigns the class</strong> — by vendor or by customer/job, your choice</li>
            <li style={{ marginBottom: 8, fontSize: 16 }}><strong>It checks it against any open purchase order</strong> — and flags discrepancies before you pay</li>
            <li style={{ marginBottom: 8, fontSize: 16 }}><strong>It pushes the completed vendor bill into QuickBooks</strong> — ready for review and payment</li>
          </ol>
          <p style={{ ...pStyle, marginBottom: 0 }}>Setup takes about 15 minutes. The first 25 invoices are completely free — no credit card required. You can even test it without connecting your live QuickBooks company first.</p>
        </OptionCard>

        <h2 style={h2Style}>Side-by-Side Comparison</h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', margin: '24px 0', fontSize: 14, minWidth: 560 }}>
            <thead>
              <tr>
                <th style={{ background: '#1A3D2B', color: 'white', padding: '12px 16px', textAlign: 'left', borderRadius: '8px 0 0 0' }}>Feature</th>
                <th style={{ background: '#1A3D2B', color: 'white', padding: '12px 16px', textAlign: 'left' }}>QBO Native Upload</th>
                <th style={{ background: '#1A3D2B', color: 'white', padding: '12px 16px', textAlign: 'left' }}>Transaction Pro / SaasAnt</th>
                <th style={{ background: '#1A3D2B', color: 'white', padding: '12px 16px', textAlign: 'left', borderRadius: '0 8px 0 0' }}>Purchasomatic</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Reads PDF invoices', ['partial', '⚡ Partial'], ['cross', '✕ No (CSV input)'], ['check', '✓ Yes']],
                ['Automatic job matching', ['cross', '✕ No'], ['cross', '✕ No'], ['check', '✓ Yes']],
                ['Class tracking', ['cross', '✕ Manual'], ['partial', '⚡ Manual in spreadsheet'], ['check', '✓ Automatic']],
                ['PO matching & discrepancy flags', ['cross', '✕ No'], ['cross', '✕ No'], ['check', '✓ Yes']],
                ['Works with QuickBooks Desktop', ['cross', '✕ QBO only'], ['check', '✓ Yes'], ['check', '✓ Yes']],
                ['Daily invoice workflow', ['partial', '⚡ Possible but slow'], ['cross', '✕ Not designed for it'], ['check', '✓ Built for it']],
                ['Free to start', ['check', '✓ Included in QBO'], ['cross', '✕ Paid subscription'], ['check', '✓ 25 invoices free']],
              ].map(([label, ...cells], i) => (
                <tr key={label as string} style={{ background: i % 2 === 1 ? '#F8FBF8' : 'transparent' }}>
                  <td style={{ padding: '12px 16px', borderBottom: '1px solid #E8F0E8', fontWeight: 600, color: '#1A3D2B' }}>{label as string}</td>
                  {(cells as [string, string][]).map(([kind, text], j) => (
                    <td key={j} style={{ padding: '12px 16px', borderBottom: '1px solid #E8F0E8' }}>
                      <span style={{ color: kind === 'check' ? '#2DB87A' : kind === 'cross' ? '#DC2626' : '#D97706', fontWeight: kind === 'check' ? 700 : 400 }}>
                        {text}
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 style={h2Style}>Which Option Is Right for You?</h2>
        <p style={pStyle}><strong>Use QuickBooks native upload if:</strong> You receive a small number of invoices per week, don&rsquo;t need job costing, and just want a basic way to get PDFs into QBO without extra software.</p>
        <p style={pStyle}><strong>Use Transaction Pro or SaasAnt if:</strong> You&rsquo;re migrating historical invoice data into QuickBooks in bulk, or your vendors provide data in spreadsheet format.</p>
        <p style={pStyle}><strong>Use Purchasomatic if:</strong> You&rsquo;re an HVAC, plumbing, electrical, roofing, or other trades contractor who receives vendor invoices regularly and needs them assigned to the right job in QuickBooks — without someone manually looking up job numbers and typing them in every day.</p>

        <div style={{ background: '#1A3D2B', color: 'white', borderRadius: 12, padding: 36, margin: '48px 0', textAlign: 'center' }}>
          <h2 style={{ color: 'white', margin: '0 0 12px', fontSize: 24, fontWeight: 700 }}>Try it with your real invoices — free</h2>
          <p style={{ color: '#A8D8B8', marginBottom: 24 }}>Forward your next 25 vendor invoices to Purchasomatic and see them land in QuickBooks already matched to the right job. No credit card. No QuickBooks connection required to start.</p>
          <Link href="/signup" style={{ display: 'inline-block', background: '#2DB87A', color: 'white', padding: '14px 28px', borderRadius: 8, textDecoration: 'none', fontWeight: 700, fontSize: 16 }}>
            Start free trial
          </Link>
          <p style={{ fontSize: 13, color: '#88B898', marginTop: 12, marginBottom: 0 }}>25 invoices free · No credit card · 15-minute setup</p>
        </div>

        <h2 style={h2Style}>Frequently Asked Questions</h2>
        <div style={{ margin: '48px 0' }}>
          {faqs.map(f => (
            <div key={f.q} style={{ borderBottom: '1px solid #E0E8E0', padding: '20px 0' }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#1A3D2B', marginBottom: 10 }}>{f.q}</div>
              <div style={{ fontSize: 15, color: '#444' }}>{f.a}</div>
            </div>
          ))}
        </div>

        <div style={{ background: '#F8FBF8', borderRadius: 10, padding: '20px 24px', margin: '48px 0 0', display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          <div style={{ background: '#2DB87A', color: 'white', width: 48, height: 48, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
            👋
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Written by Heather Dillon, Founder of Purchasomatic</div>
            <p style={{ fontSize: 14, color: '#555', margin: '4px 0 0' }}>
              Heather spent years as the office manager at an HVAC company, entering vendor invoices into QuickBooks by hand every afternoon. She built Purchasomatic so no one else has to. If you have questions, reply to any email or call (541) 250-0448.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
