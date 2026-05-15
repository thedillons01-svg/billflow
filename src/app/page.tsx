import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Purchasomatic — Automated Invoice Capture for QuickBooks Contractors',
  description:
    'Forward vendor invoices once. Purchasomatic reads every line item, matches the right QuickBooks job, and publishes automatically — no data entry required.',
}

export default async function LandingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user) redirect('/bills')

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: 'var(--font-geist-sans), system-ui, sans-serif' }}>
      <Nav />
      <Hero />
      <LogoStrip />
      <HowItWorks />
      <Features />
      <Pricing />
      <Testimonials />
      <CtaBanner />
      <Footer />
    </div>
  )
}

/* ─── Nav ─────────────────────────────────────────────────────────── */

function Nav() {
  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: 'rgba(255,255,255,0.95)',
        backdropFilter: 'blur(8px)',
        borderBottom: '1px solid #E5E7EB',
      }}
    >
      <div
        style={{
          maxWidth: 1100,
          margin: '0 auto',
          padding: '0 24px',
          height: 60,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 28,
              height: 28,
              background: '#2DB87A',
              borderRadius: 7,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <i className="ti ti-file-invoice" style={{ fontSize: 15, color: 'white' }} />
          </div>
          <span style={{ fontSize: 16, fontWeight: 600, color: '#1A3D2B', letterSpacing: '-0.01em' }}>
            Purchasomatic
          </span>
        </div>

        {/* Nav links */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Link
            href="/login"
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: '#4B5563',
              textDecoration: 'none',
              padding: '6px 14px',
              borderRadius: 6,
            }}
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: 'white',
              textDecoration: 'none',
              background: '#2DB87A',
              padding: '7px 18px',
              borderRadius: 7,
            }}
          >
            Get started free
          </Link>
        </nav>
      </div>
    </header>
  )
}

/* ─── Hero ────────────────────────────────────────────────────────── */

function Hero() {
  return (
    <section style={{ background: '#1A3D2B', padding: '88px 24px 100px' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', textAlign: 'center' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: 'rgba(45,184,122,0.18)',
            border: '1px solid rgba(45,184,122,0.35)',
            borderRadius: 20,
            padding: '4px 14px',
            marginBottom: 28,
          }}
        >
          <i className="ti ti-bolt" style={{ fontSize: 12, color: '#2DB87A' }} />
          <span style={{ fontSize: 12, fontWeight: 500, color: '#2DB87A', letterSpacing: '0.02em' }}>
            Powered by AI · Made for contractors
          </span>
        </div>

        <h1
          style={{
            fontSize: 'clamp(36px, 5.5vw, 58px)',
            fontWeight: 700,
            color: 'white',
            lineHeight: 1.08,
            letterSpacing: '-0.03em',
            marginBottom: 22,
          }}
        >
          Vendor invoices in QuickBooks.
          <br />
          <span style={{ color: '#2DB87A' }}>Without the data entry.</span>
        </h1>

        <p
          style={{
            fontSize: 18,
            color: 'rgba(255,255,255,0.72)',
            lineHeight: 1.65,
            maxWidth: 580,
            margin: '0 auto 40px',
          }}
        >
          Forward vendor invoices to Purchasomatic once. We extract every line item, match it to the right QuickBooks job, and publish automatically — while you run the business.
        </p>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Link
            href="/signup"
            style={{
              background: '#2DB87A',
              color: 'white',
              fontSize: 15,
              fontWeight: 600,
              padding: '13px 28px',
              borderRadius: 8,
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            Start free trial
            <i className="ti ti-arrow-right" style={{ fontSize: 15 }} />
          </Link>
          <Link
            href="/login"
            style={{
              background: 'rgba(255,255,255,0.1)',
              color: 'white',
              fontSize: 15,
              fontWeight: 500,
              padding: '13px 28px',
              borderRadius: 8,
              textDecoration: 'none',
              border: '1px solid rgba(255,255,255,0.2)',
            }}
          >
            Sign in
          </Link>
        </div>

        <p style={{ marginTop: 18, fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
          No subscription required · Pay per transaction · Cancel any time
        </p>

        {/* Hero stats */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 48,
            marginTop: 64,
            paddingTop: 48,
            borderTop: '1px solid rgba(255,255,255,0.1)',
            flexWrap: 'wrap',
          }}
        >
          {[
            { value: '1 credit', label: 'per invoice or PO' },
            { value: '< 60 sec', label: 'average processing time' },
            { value: 'QBO + QBD', label: 'QuickBooks supported' },
          ].map(stat => (
            <div key={stat.label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 26, fontWeight: 700, color: '#2DB87A', letterSpacing: '-0.02em' }}>
                {stat.value}
              </div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─── Logo strip ──────────────────────────────────────────────────── */

function LogoStrip() {
  const distributors = [
    'Ferguson', 'Gensco', 'Winsupply', 'Johnstone Supply',
    'Carrier Enterprise', 'Baker Distributing',
  ]
  return (
    <div
      style={{
        background: '#F9FAFB',
        borderBottom: '1px solid #E5E7EB',
        padding: '20px 24px',
        textAlign: 'center',
      }}
    >
      <p style={{ fontSize: 12, color: '#9CA3AF', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 16 }}>
        Reads invoices from the distributors you already use
      </p>
      <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '8px 28px' }}>
        {distributors.map(name => (
          <span key={name} style={{ fontSize: 14, fontWeight: 600, color: '#6B7280', letterSpacing: '-0.01em' }}>
            {name}
          </span>
        ))}
      </div>
    </div>
  )
}

/* ─── How it works ────────────────────────────────────────────────── */

function HowItWorks() {
  const steps = [
    {
      icon: 'ti-mail-forward',
      number: '01',
      title: 'Forward vendor emails',
      body: 'Set up a one-time email forwarding rule. Invoices from Ferguson, Gensco, Winsupply — any distributor — arrive in Purchasomatic automatically when your vendor sends them to you.',
    },
    {
      icon: 'ti-cpu',
      number: '02',
      title: 'AI extracts every line item',
      body: 'Purchasomatic reads the PDF — vendor name, invoice number, due date, every line item and amount. Even scanned documents. No templates to set up. Shared format knowledge means the system gets smarter for every customer.',
    },
    {
      icon: 'ti-brand-quickbooks',
      number: '03',
      title: 'Published to QuickBooks',
      body: 'After a quick review — or automatically if auto-publish is on — the bill lands in QuickBooks coded to the correct job and GL account. QuickBooks Online and Desktop both supported.',
    },
  ]

  return (
    <section style={{ padding: '88px 24px', background: 'white' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#2DB87A', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
            How it works
          </p>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 700, color: '#111827', letterSpacing: '-0.025em', lineHeight: 1.15 }}>
            Set it up once. Let it run.
          </h2>
          <p style={{ fontSize: 16, color: '#6B7280', marginTop: 14, maxWidth: 480, margin: '14px auto 0' }}>
            No templates. No per-vendor setup. Works with any PDF invoice from any distributor.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 32 }}>
          {steps.map((step, i) => (
            <div key={i}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  background: '#EBF5EF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 20,
                }}
              >
                <i className={`ti ${step.icon}`} style={{ fontSize: 22, color: '#2DB87A' }} />
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#2DB87A', letterSpacing: '0.08em', marginBottom: 8 }}>
                STEP {step.number}
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 600, color: '#111827', marginBottom: 10, letterSpacing: '-0.01em' }}>
                {step.title}
              </h3>
              <p style={{ fontSize: 15, color: '#6B7280', lineHeight: 1.65 }}>
                {step.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─── Features ────────────────────────────────────────────────────── */

function Features() {
  const features = [
    {
      icon: 'ti-briefcase',
      title: 'Job costing built in',
      body: 'Purchasomatic matches each invoice to the right QuickBooks job from your field service platform — Housecall Pro, Workiz, ServiceTrade, Jobber. Line items land on the correct job automatically.',
    },
    {
      icon: 'ti-rocket',
      title: 'Auto-publish after 5 invoices',
      body: 'After 5 accurate invoices from a vendor, Purchasomatic promotes them to auto-publish. Bills go straight to QuickBooks without a review step. You get notified when it happens.',
    },
    {
      icon: 'ti-truck-delivery',
      title: 'Purchase order tracking',
      body: 'Capture PO confirmations from suppliers. When the invoice arrives, Purchasomatic matches it to the open PO, flags discrepancies, and creates the linked bill in QuickBooks.',
    },
    {
      icon: 'ti-clipboard-check',
      title: 'Receiving workflow',
      body: 'Techs in the field can check off what actually arrived against the PO — on any device. No more phone calls asking what was ordered or when it shipped.',
    },
    {
      icon: 'ti-plug-connected',
      title: 'QuickBooks Online & Desktop',
      body: 'Full support for both. QBO connects via OAuth. QBD connects via the Web Connector — bills and attachments sync on your schedule.',
    },
    {
      icon: 'ti-shield-check',
      title: 'Duplicate detection',
      body: 'Purchasomatic catches duplicate invoices before they reach QuickBooks. No charge for rejected duplicates — only successful, unique transactions use credits.',
    },
  ]

  return (
    <section style={{ padding: '88px 24px', background: '#F9FAFB', borderTop: '1px solid #E5E7EB' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#2DB87A', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
            Features
          </p>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 700, color: '#111827', letterSpacing: '-0.025em', lineHeight: 1.15 }}>
            Built for trade contractors,
            <br />not generic accounting
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
          {features.map((f, i) => (
            <div
              key={i}
              style={{
                background: 'white',
                borderRadius: 12,
                border: '1px solid #E5E7EB',
                padding: '28px 28px 32px',
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: '#EBF5EF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 16,
                }}
              >
                <i className={`ti ${f.icon}`} style={{ fontSize: 20, color: '#2DB87A' }} />
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: '#111827', marginBottom: 8, letterSpacing: '-0.01em' }}>
                {f.title}
              </h3>
              <p style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.65 }}>
                {f.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─── Pricing ─────────────────────────────────────────────────────── */

const PACKAGES = [
  { credits: 50,   price: 20,  label: '50 credits',    rate: '$0.40 / transaction',             popular: false },
  { credits: 100,  price: 40,  label: '100 credits',   rate: '$0.40 / transaction',             popular: false },
  { credits: 500,  price: 190, label: '500 credits',   rate: '$0.38 / transaction — save 5%',  popular: true  },
  { credits: 1000, price: 360, label: '1,000 credits', rate: '$0.36 / transaction — save 10%', popular: false },
]

function Pricing() {
  return (
    <section style={{ padding: '88px 24px', background: 'white', borderTop: '1px solid #E5E7EB' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#2DB87A', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
            Pricing
          </p>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 700, color: '#111827', letterSpacing: '-0.025em', lineHeight: 1.15, marginBottom: 14 }}>
            Pay only for what you process
          </h2>
          <p style={{ fontSize: 16, color: '#6B7280', maxWidth: 480, margin: '0 auto' }}>
            1 credit per invoice or PO. Credits never expire. No charge for duplicates, reprocessing, or wrong document type.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 16 }}>
          {PACKAGES.map(pkg => (
            <div
              key={pkg.credits}
              style={{
                borderRadius: 12,
                border: pkg.popular ? '2px solid #2DB87A' : '1px solid #E5E7EB',
                background: pkg.popular ? '#EBF5EF' : 'white',
                padding: '28px 24px 24px',
                position: 'relative',
                textAlign: 'center',
              }}
            >
              {pkg.popular && (
                <div
                  style={{
                    position: 'absolute',
                    top: -12,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: '#2DB87A',
                    color: 'white',
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    padding: '3px 12px',
                    borderRadius: 20,
                    textTransform: 'uppercase',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Most popular
                </div>
              )}

              <div style={{ fontSize: 32, fontWeight: 700, color: '#111827', letterSpacing: '-0.02em', marginBottom: 2 }}>
                ${pkg.price}
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                {pkg.label}
              </div>
              <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 24 }}>
                {pkg.rate}
              </div>
              <Link
                href="/signup"
                style={{
                  display: 'block',
                  background: pkg.popular ? '#2DB87A' : '#1A3D2B',
                  color: 'white',
                  fontSize: 13,
                  fontWeight: 600,
                  padding: '9px 0',
                  borderRadius: 7,
                  textDecoration: 'none',
                  textAlign: 'center',
                }}
              >
                Get started
              </Link>
            </div>
          ))}
        </div>

        <p style={{ textAlign: 'center', fontSize: 13, color: '#9CA3AF', marginTop: 24 }}>
          Comparable to AutoEntry at roughly the same per-transaction rate — with job costing, PO tracking, and QuickBooks Desktop support included.
        </p>
      </div>
    </section>
  )
}

/* ─── Testimonials ────────────────────────────────────────────────── */

function Testimonials() {
  const quotes = [
    {
      quote: "We were spending 3-4 hours a week on invoice data entry across two bookkeepers. Purchasomatic cut that to almost nothing. The job matching is what sold us — it just works.",
      name: 'Office Manager',
      company: 'HVAC Contractor, Pacific Northwest',
      initials: 'OM',
    },
    {
      quote: "I was skeptical it could read our Gensco invoices correctly — they're complicated. It got every line item right on the first try. Auto-publish has been running for two months without a mistake.",
      name: 'Owner / Bookkeeper',
      company: 'Mechanical Contractor, Texas',
      initials: 'OB',
    },
    {
      quote: "The PO matching is huge for us. When a vendor invoice comes in short or with a price difference, we know immediately instead of finding out at month end.",
      name: 'Controller',
      company: 'Plumbing & HVAC, Southeast',
      initials: 'CT',
    },
  ]

  return (
    <section style={{ padding: '88px 24px', background: '#F9FAFB', borderTop: '1px solid #E5E7EB' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 52 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#2DB87A', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
            From the field
          </p>
          <h2 style={{ fontSize: 'clamp(24px, 3.5vw, 36px)', fontWeight: 700, color: '#111827', letterSpacing: '-0.025em' }}>
            Contractors who stopped typing invoices
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
          {quotes.map((q, i) => (
            <div
              key={i}
              style={{
                background: 'white',
                borderRadius: 12,
                border: '1px solid #E5E7EB',
                padding: '28px 28px 24px',
              }}
            >
              <i className="ti ti-quote" style={{ fontSize: 28, color: '#D1FAE5', display: 'block', marginBottom: 16 }} />
              <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.7, marginBottom: 24 }}>
                &ldquo;{q.quote}&rdquo;
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: '#1A3D2B',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    fontWeight: 700,
                    color: 'white',
                    flexShrink: 0,
                  }}
                >
                  {q.initials}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{q.name}</div>
                  <div style={{ fontSize: 12, color: '#6B7280' }}>{q.company}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─── CTA Banner ──────────────────────────────────────────────────── */

function CtaBanner() {
  return (
    <section style={{ padding: '80px 24px', background: '#1A3D2B' }}>
      <div style={{ maxWidth: 680, margin: '0 auto', textAlign: 'center' }}>
        <h2
          style={{
            fontSize: 'clamp(28px, 4vw, 40px)',
            fontWeight: 700,
            color: 'white',
            letterSpacing: '-0.025em',
            lineHeight: 1.15,
            marginBottom: 18,
          }}
        >
          Stop thinking about invoices.
          <br />
          <span style={{ color: '#2DB87A' }}>Let Purchasomatic handle them.</span>
        </h2>
        <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.65)', marginBottom: 36, lineHeight: 1.65 }}>
          Set up takes less than 10 minutes. Forward your first invoice today and see it in QuickBooks before lunch.
        </p>
        <Link
          href="/signup"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            background: '#2DB87A',
            color: 'white',
            fontSize: 15,
            fontWeight: 600,
            padding: '14px 32px',
            borderRadius: 8,
            textDecoration: 'none',
          }}
        >
          Start free trial
          <i className="ti ti-arrow-right" style={{ fontSize: 15 }} />
        </Link>
        <p style={{ marginTop: 14, fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>
          Questions? Email{' '}
          <a href="mailto:support@purchasomatic.com" style={{ color: 'rgba(255,255,255,0.55)', textDecoration: 'none' }}>
            support@purchasomatic.com
          </a>
        </p>
      </div>
    </section>
  )
}

/* ─── Footer ──────────────────────────────────────────────────────── */

function Footer() {
  return (
    <footer style={{ background: '#111827', padding: '40px 24px' }}>
      <div
        style={{
          maxWidth: 1100,
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 24,
              height: 24,
              background: '#2DB87A',
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <i className="ti ti-file-invoice" style={{ fontSize: 13, color: 'white' }} />
          </div>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'white' }}>Purchasomatic</span>
          <span style={{ fontSize: 13, color: '#4B5563', marginLeft: 8 }}>
            &copy; {new Date().getFullYear()} Dillon Software
          </span>
        </div>

        <nav style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          {[
            { label: 'Sign in', href: '/login' },
            { label: 'Create account', href: '/signup' },
            { label: 'support@purchasomatic.com', href: 'mailto:support@purchasomatic.com' },
          ].map(link => (
            <a
              key={link.href}
              href={link.href}
              style={{ fontSize: 13, color: '#6B7280', textDecoration: 'none' }}
            >
              {link.label}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  )
}
