import type { Metadata } from 'next'
import Link from 'next/link'
import { blogPosts } from '../posts'

const post = blogPosts.find(p => p.slug === 'job-costing-in-quickbooks-for-trades-contractors')!
const canonicalPath = `/blog/${post.slug}`

export const metadata: Metadata = {
  title: post.title,
  description: post.description,
  keywords: [
    'job costing quickbooks',
    'quickbooks job costing for contractors',
    'track job profitability quickbooks',
    'quickbooks online projects vs jobs',
    'job costing trades businesses',
  ],
  alternates: { canonical: canonicalPath },
  openGraph: {
    title: post.title,
    description: 'Job costing tells you which jobs make money and which ones quietly don’t — if the numbers going into it are actually right.',
    url: canonicalPath,
    type: 'article',
  },
}

const faqs = [
  {
    q: 'Does QuickBooks Online do job costing?',
    a: 'Yes. QuickBooks Online supports job costing through sub-customers (jobs under a customer) or, on Plus and Advanced plans, the Projects feature. Neither one is turned on by default, and neither one codes your vendor bills to the right job for you — that part is still manual.',
  },
  {
    q: 'What’s the difference between Projects and Customer:Job in QuickBooks Online?',
    a: 'Customer:Job is the older structure — you create a "job" as a sub-customer underneath a customer, and every transaction gets tagged to that sub-customer. Projects (Plus/Advanced only) is a newer feature built specifically for job costing: it groups transactions, shows a running profitability summary, and doesn’t require restructuring your customer list. Most trades businesses on Plus or Advanced should use Projects going forward; Customer:Job still works fine and is the only option on Simple Start or Essentials.',
  },
  {
    q: 'Why does my QuickBooks job costing report look wrong?',
    a: 'Almost always because some vendor bills were never assigned to a job — or were assigned to the wrong one. QuickBooks can only report on what was tagged correctly at entry. If bill entry happens under deadline pressure (which it usually does), miscoded and untagged lines are the normal outcome, not the exception.',
  },
  {
    q: 'Can QuickBooks automatically assign vendor bills to the right job?',
    a: 'No — not on its own. QuickBooks’s native bill upload reads the vendor and amount off a PDF, but a person still has to pick the job and class for every line, every time. Purchasomatic adds that missing step: it reads the invoice, matches it to the right job in QuickBooks automatically, and codes each line before it ever reaches your books.',
  },
  {
    q: 'How much job costing detail do I actually need as a small trades business?',
    a: 'Enough to answer one question with confidence: did this job make money? For most contractors that means labor cost, material cost (from vendor bills), and revenue, rolled up per job or per project. You don’t need elaborate cost-code structures to get value from job costing — you need the vendor-bill side to actually be accurate, since that’s usually the biggest cost category and the one most likely to be wrong.',
  },
]

function StepCard({
  num,
  title,
  children,
}: {
  num: string
  title: string
  children: React.ReactNode
}) {
  return (
    <div style={{ display: 'flex', gap: 16, margin: '0 0 28px' }}>
      <div
        style={{
          background: '#1A3D2B',
          color: 'white',
          width: 32,
          height: 32,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 700,
          fontSize: 14,
          flexShrink: 0,
        }}
      >
        {num}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: '#1A2A1A', marginBottom: 6 }}>{title}</div>
        {children}
      </div>
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
          Job costing tells you which jobs made money. But that’s only true if the numbers feeding it are right — and for most trades businesses, the vendor-bill side never quite is.
        </p>
        <p style={{ fontSize: 13, color: '#888' }}>
          By <strong style={{ color: '#555' }}>Heather Dillon</strong>, former HVAC office manager &middot; Founder of Purchasomatic
        </p>
      </div>

      <div style={{ maxWidth: 780, margin: '0 auto', padding: '48px 24px 80px', fontSize: 16, lineHeight: 1.7, color: '#333' }}>

        <p style={pStyle}>
          I ran accounts payable for an HVAC and mechanical contractor for years. We turned on job costing in QuickBooks early on, because the owner wanted to know which jobs were actually profitable. The reports looked complete. They were also wrong, constantly — not because job costing itself was broken, but because half the vendor bills that fed into it had been coded to the wrong job, or no job at all, by whoever was rushing to get invoices entered before end of day.
        </p>
        <p style={pStyle}>
          That’s the part almost nobody talks about when they explain job costing. Setting it up is the easy half. Keeping the data underneath it honest is the part that actually determines whether you can trust the report — and it applies whether you’re HVAC, plumbing, electrical, roofing, or general contracting.
        </p>

        <h2 style={h2Style}>What Job Costing Actually Means in QuickBooks</h2>
        <p style={pStyle}>
          Job costing is just tracking income and expenses <em>per job</em> instead of just per company. QuickBooks Online gives you two ways to structure that:
        </p>
        <ul style={{ paddingLeft: 24, marginBottom: 20 }}>
          <li style={{ marginBottom: 10, fontSize: 16 }}>
            <strong>Customer:Job (sub-customers).</strong> Available on every QBO plan. You create a customer, then create a "sub-customer" underneath it for each job. Every invoice, bill, and expense gets tagged to that sub-customer.
          </li>
          <li style={{ marginBottom: 10, fontSize: 16 }}>
            <strong>Projects.</strong> Available on Plus and Advanced. A purpose-built job costing view — it groups every transaction tied to a job and shows a running profitability summary (income, costs, and profit margin) without you having to build a separate report.
          </li>
        </ul>
        <p style={pStyle}>
          Neither one requires QuickBooks Desktop or a third-party app to turn on. Both are sitting in your QuickBooks account right now, whether you’re using them or not.
        </p>

        <h2 style={h2Style}>Setting It Up Correctly</h2>
        <StepCard num="1" title="Turn on job costing preferences">
          <p style={pStyle}>Settings &rarr; Account and Settings &rarr; Advanced &rarr; Categories. Turn on "Track expenses and items by customer" if it isn’t already — this is what lets bills and expenses carry a job/customer tag at all.</p>
        </StepCard>
        <StepCard num="2" title="Pick a structure and stick with it">
          <p style={pStyle}>If you’re on Plus or Advanced, use Projects for anything going forward — it’s built for this and gives you the profitability view for free. If you’re on Simple Start or Essentials, Customer:Job is your only option; create the job as a sub-customer of the actual customer, not as a new top-level customer, so your customer list doesn’t fragment.</p>
        </StepCard>
        <StepCard num="3" title="Assign a class if you track cost types">
          <p style={pStyle}>Classes let you split a job’s costs further — labor vs. materials vs. equipment, for example. Not required, but useful if you bid jobs by cost category and want to compare bid vs. actual by type, not just in total.</p>
        </StepCard>
        <StepCard num="4" title="Code every vendor bill to the job it belongs to">
          <p style={pStyle}>This is the step that actually determines whether the report means anything — and the one that breaks down first under any kind of volume or deadline pressure.</p>
        </StepCard>

        <h2 style={h2Style}>The Part QuickBooks Doesn’t Do For You</h2>
        <p style={pStyle}>
          QuickBooks Online has a native bill upload (Expenses &rarr; Bills &rarr; Add Bill &rarr; Upload multiple bills) that reads the vendor name and total off a PDF. It does not know which job that Ferguson or Winsupply invoice belongs to. Someone still has to look at every line, remember or look up the right job, and assign it — for every vendor bill, every week, indefinitely.
        </p>
        <p style={pStyle}>
          That step is where job costing quietly falls apart in most shops. Not from lack of will — from volume. Twenty invoices on a Friday afternoon with three other things going on is exactly the condition under which "I’ll fix the job later" invoices pile up and never get fixed. Six months later, the job profitability report says a job lost money, and nobody can tell if that’s true or if $4,000 in material costs just landed on the wrong job number.
        </p>

        <div style={{ background: '#F0FAF5', border: '1px solid #2DB87A', borderRadius: 8, padding: '20px 24px', margin: '32px 0', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <p style={{ margin: 0, flex: 1, minWidth: 200, fontSize: 15 }}>
            Purchasomatic handles exactly this step — matching every vendor invoice to the right job before it ever reaches your books, automatically.
          </p>
          <Link href="/signup" style={{ display: 'inline-block', background: '#2DB87A', color: 'white', padding: '10px 20px', borderRadius: 6, textDecoration: 'none', fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap' }}>
            Try free — 25 invoices
          </Link>
        </div>

        <h2 style={h2Style}>How Purchasomatic Fixes the Weak Link</h2>
        <p style={pStyle}>Forward a vendor invoice to Purchasomatic and here’s what happens before it lands in QuickBooks:</p>
        <ol style={{ paddingLeft: 24, marginBottom: 20 }}>
          <li style={{ marginBottom: 8, fontSize: 16 }}><strong>It reads the PDF</strong> — vendor, line items, amounts, invoice number, even on scanned documents.</li>
          <li style={{ marginBottom: 8, fontSize: 16 }}><strong>It matches the invoice to the right job or Project in QuickBooks</strong> — using vendor history, PO references, and invoice details, not a guess.</li>
          <li style={{ marginBottom: 8, fontSize: 16 }}><strong>It assigns the class</strong>, if you track cost types — by vendor default or by job, your call.</li>
          <li style={{ marginBottom: 8, fontSize: 16 }}><strong>It checks the invoice against any open purchase order</strong> and flags price or quantity mismatches before you pay.</li>
          <li style={{ marginBottom: 8, fontSize: 16 }}><strong>It publishes a fully-coded bill to QuickBooks</strong> — job assigned, class set, ready for review or auto-published after your first few accurate invoices from that vendor.</li>
        </ol>
        <p style={pStyle}>
          The job costing structure doesn’t change. Whether you’re on Customer:Job or Projects, Purchasomatic tags the transaction the same way a careful person would — just without the Friday-afternoon shortcut of "I’ll fix it later."
        </p>

        <div style={{ background: '#1A3D2B', color: 'white', borderRadius: 12, padding: 36, margin: '48px 0', textAlign: 'center' }}>
          <h2 style={{ color: 'white', margin: '0 0 12px', fontSize: 24, fontWeight: 700 }}>See your real job profitability</h2>
          <p style={{ color: '#A8D8B8', marginBottom: 24 }}>Forward your next 25 vendor invoices to Purchasomatic and see them land in QuickBooks already matched to the right job. No credit card. No QuickBooks connection required to start.</p>
          <Link href="/signup" style={{ display: 'inline-block', background: '#2DB87A', color: 'white', padding: '14px 28px', borderRadius: 8, textDecoration: 'none', fontWeight: 700, fontSize: 16 }}>
            Start free trial
          </Link>
          <p style={{ fontSize: 13, color: '#88B898', marginTop: 12, marginBottom: 0 }}>25 invoices free &middot; No credit card &middot; 15-minute setup</p>
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
              Heather ran accounts payable for years at an HVAC and mechanical contractor that was barely breaking even — job costing was supposed to explain why, but the numbers were only as good as the bill coding underneath them. She built Purchasomatic to fix that step. If you have questions, reply to any email or call (541) 250-0448.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
