import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Pricing — Purchasomatic',
  description: 'Simple per-transaction pricing. Start with 25 free credits — no credit card required. Subscribe when you\'re ready.',
}

const PACKAGES = [
  {
    name: 'Starter',
    price: 76,
    credits: 200,
    rate: '$0.38',
    popular: false,
    description: 'For smaller contractors or teams getting started with automated invoice capture.',
  },
  {
    name: 'Professional',
    price: 180,
    credits: 500,
    rate: '$0.36',
    popular: true,
    description: 'For active contractors processing invoices and POs from multiple vendors every month.',
  },
]

const CREDIT_RULES = [
  { icon: 'ti-file-invoice',    label: 'Vendor invoice',      cost: '1 credit',  note: 'Line item extraction always included' },
  { icon: 'ti-truck-delivery',  label: 'Purchase order',       cost: '1 credit',  note: 'Matched to invoice when it arrives' },
  { icon: 'ti-refresh',         label: 'Reprocessing',         cost: 'Free',      note: 'Re-run OCR or re-apply vendor defaults' },
  { icon: 'ti-copy',            label: 'Duplicate detected',   cost: 'Free',      note: 'Held for review, never charged' },
  { icon: 'ti-x',               label: 'Wrong document type',  cost: 'Free',      note: 'Rejected with a redirect message' },
]

const FAQS = [
  {
    q: 'What counts as a credit?',
    a: 'One credit per successfully processed invoice or purchase order. Reprocessing, duplicates, and rejected documents never use a credit.',
  },
  {
    q: 'Do unused credits roll over?',
    a: 'Yes. Credits roll over month to month and never expire.',
  },
  {
    q: 'What if I need more credits mid-month?',
    a: 'You can top up at any time at $0.38 per credit. Top-ups are available from your account billing page.',
  },
  {
    q: 'Is there a free trial?',
    a: 'Yes — every new account starts with 25 free trial credits. No credit card required. You only need to subscribe when you\'re ready to continue after the trial.',
  },
  {
    q: 'Can I cancel any time?',
    a: 'Yes. Cancel before your next billing date and you won\'t be charged again. Your remaining credits stay in your account.',
  },
  {
    q: 'Do you offer annual billing?',
    a: 'Not yet — monthly only for now. Email support@purchasomatic.com if annual billing would make a difference for your business.',
  },
  {
    q: 'Does Purchasomatic work with QuickBooks Desktop?',
    a: 'QuickBooks Online is fully supported. QuickBooks Desktop support via Web Connector is in development — email support@purchasomatic.com to be notified when it\'s available.',
  },
]

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: 'var(--font-geist-sans), system-ui, sans-serif' }}>
      <Nav />

      {/* Hero */}
      <section style={{ background: '#1A3D2B', padding: '80px 24px 88px' }}>
        <div style={{ maxWidth: 680, margin: '0 auto', textAlign: 'center' }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#2DB87A', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 14 }}>
            Pricing
          </p>
          <h1 style={{ fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 700, color: 'white', letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: 18 }}>
            Pay per transaction.<br />
            <span style={{ color: '#2DB87A' }}>Nothing else.</span>
          </h1>
          <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.7)', lineHeight: 1.65, maxWidth: 520, margin: '0 auto' }}>
            Start with 25 free credits. Subscribe when you're ready. Every invoice and PO is one credit — line item extraction included.
          </p>
        </div>
      </section>

      {/* Plans */}
      <section style={{ padding: '72px 24px', background: 'white' }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
            {PACKAGES.map(pkg => (
              <div
                key={pkg.name}
                style={{
                  borderRadius: 14,
                  border: pkg.popular ? '2px solid #2DB87A' : '1px solid #E5E7EB',
                  background: pkg.popular ? '#EBF5EF' : 'white',
                  padding: '32px 28px 28px',
                  position: 'relative',
                }}
              >
                {pkg.popular && (
                  <div style={{
                    position: 'absolute', top: -13, left: '50%', transform: 'translateX(-50%)',
                    background: '#2DB87A', color: 'white', fontSize: 10, fontWeight: 700,
                    letterSpacing: '0.06em', padding: '3px 14px', borderRadius: 20,
                    textTransform: 'uppercase', whiteSpace: 'nowrap',
                  }}>
                    Most popular
                  </div>
                )}
                <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 14 }}>
                  {pkg.name}
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, marginBottom: 2 }}>
                  <span style={{ fontSize: 44, fontWeight: 700, color: '#111827', letterSpacing: '-0.03em', lineHeight: 1 }}>${pkg.price}</span>
                  <span style={{ fontSize: 14, color: '#6B7280', marginBottom: 6 }}>/month</span>
                </div>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                  {pkg.credits} credits / month
                </div>
                <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 6 }}>
                  {pkg.rate} per transaction
                </div>
                <p style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.55, marginBottom: 24 }}>
                  {pkg.description}
                </p>
                <Link
                  href="/signup"
                  style={{
                    display: 'block', textAlign: 'center',
                    background: pkg.popular ? '#2DB87A' : '#1A3D2B',
                    color: 'white', fontSize: 14, fontWeight: 600,
                    padding: '11px 0', borderRadius: 8, textDecoration: 'none',
                  }}
                >
                  Start free trial
                </Link>
              </div>
            ))}
          </div>

          <p style={{ textAlign: 'center', fontSize: 13, color: '#9CA3AF', marginTop: 24 }}>
            Credits roll over · No charge for duplicates or reprocessing · Cancel any time
          </p>
        </div>
      </section>

      {/* What costs a credit */}
      <section style={{ padding: '72px 24px', background: '#F9FAFB', borderTop: '1px solid #E5E7EB' }}>
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 44 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#2DB87A', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
              Credit usage
            </p>
            <h2 style={{ fontSize: 'clamp(24px, 3.5vw, 34px)', fontWeight: 700, color: '#111827', letterSpacing: '-0.025em' }}>
              You only pay for what works.
            </h2>
          </div>

          <div style={{ background: 'white', borderRadius: 12, border: '1px solid #E5E7EB', overflow: 'hidden' }}>
            {CREDIT_RULES.map((rule, i) => (
              <div
                key={i}
                style={{
                  display: 'flex', alignItems: 'center', gap: 16,
                  padding: '16px 24px',
                  borderBottom: i < CREDIT_RULES.length - 1 ? '1px solid #F3F4F6' : 'none',
                }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                  background: rule.cost === 'Free' ? '#F3F4F6' : '#EBF5EF',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <i className={`ti ${rule.icon}`} style={{ fontSize: 18, color: rule.cost === 'Free' ? '#9CA3AF' : '#2DB87A' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 14, fontWeight: 500, color: '#111827' }}>{rule.label}</p>
                  <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 1 }}>{rule.note}</p>
                </div>
                <div style={{
                  fontSize: 13, fontWeight: 700,
                  color: rule.cost === 'Free' ? '#6B7280' : '#2DB87A',
                  background: rule.cost === 'Free' ? '#F3F4F6' : '#EBF5EF',
                  padding: '3px 10px', borderRadius: 6, whiteSpace: 'nowrap',
                }}>
                  {rule.cost}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section style={{ padding: '72px 24px', background: 'white', borderTop: '1px solid #E5E7EB' }}>
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 44 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#2DB87A', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
              FAQ
            </p>
            <h2 style={{ fontSize: 'clamp(24px, 3.5vw, 34px)', fontWeight: 700, color: '#111827', letterSpacing: '-0.025em' }}>
              Common questions
            </h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {FAQS.map((faq, i) => (
              <div
                key={i}
                style={{
                  padding: '22px 0',
                  borderBottom: i < FAQS.length - 1 ? '1px solid #F3F4F6' : 'none',
                }}
              >
                <p style={{ fontSize: 15, fontWeight: 600, color: '#111827', marginBottom: 8 }}>{faq.q}</p>
                <p style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.65 }}>{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: '80px 24px', background: '#1A3D2B' }}>
        <div style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: 'clamp(26px, 4vw, 38px)', fontWeight: 700, color: 'white', letterSpacing: '-0.025em', lineHeight: 1.15, marginBottom: 16 }}>
            Start with 25 free credits.
          </h2>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.65)', marginBottom: 32, lineHeight: 1.65 }}>
            No credit card required. Connect QuickBooks, set up forwarding, and forward your first invoice.
          </p>
          <Link
            href="/signup"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: '#2DB87A', color: 'white',
              fontSize: 15, fontWeight: 600,
              padding: '13px 28px', borderRadius: 8, textDecoration: 'none',
            }}
          >
            Create free account
            <i className="ti ti-arrow-right" style={{ fontSize: 15 }} />
          </Link>
          <p style={{ marginTop: 14, fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>
            Questions?{' '}
            <a href="mailto:support@purchasomatic.com" style={{ color: 'rgba(255,255,255,0.5)', textDecoration: 'none' }}>
              support@purchasomatic.com
            </a>
          </p>
        </div>
      </section>

      <Footer />
    </div>
  )
}

function Nav() {
  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 50,
      background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(8px)',
      borderBottom: '1px solid #E5E7EB',
    }}>
      <div style={{
        maxWidth: 1100, margin: '0 auto', padding: '0 24px',
        height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
          <img src="/logo-28.png" alt="Purchasomatic" style={{ width: 28, height: 28 }} />
          <span style={{ fontSize: 16, fontWeight: 600, color: '#1A3D2B', letterSpacing: '-0.01em' }}>Purchasomatic</span>
        </Link>
        <nav style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Link href="/help" style={{ fontSize: 14, fontWeight: 500, color: '#4B5563', textDecoration: 'none', padding: '6px 14px' }}>
            Help
          </Link>
          <Link href="/login" style={{ fontSize: 14, fontWeight: 500, color: '#4B5563', textDecoration: 'none', padding: '6px 14px' }}>
            Sign in
          </Link>
          <Link href="/signup" style={{
            fontSize: 14, fontWeight: 600, color: 'white', textDecoration: 'none',
            background: '#2DB87A', padding: '7px 18px', borderRadius: 7,
          }}>
            Get started free
          </Link>
        </nav>
      </div>
    </header>
  )
}

function Footer() {
  return (
    <footer style={{ background: '#111827', padding: '40px 24px' }}>
      <div style={{
        maxWidth: 1100, margin: '0 auto',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <img src="/logo-28.png" alt="Purchasomatic" style={{ width: 24, height: 24 }} />
          <span style={{ fontSize: 14, fontWeight: 600, color: 'white' }}>Purchasomatic</span>
          <span style={{ fontSize: 13, color: '#4B5563', marginLeft: 8 }}>&copy; {new Date().getFullYear()} Heather Dillon</span>
        </div>
        <nav style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          {[
            { label: 'Pricing', href: '/pricing' },
            { label: 'Help', href: '/help' },
            { label: 'Sign in', href: '/login' },
            { label: 'Privacy Policy', href: '/privacy' },
            { label: 'Terms of Service', href: '/terms' },
            { label: 'support@purchasomatic.com', href: 'mailto:support@purchasomatic.com' },
          ].map(link => (
            <a key={link.href} href={link.href} style={{ fontSize: 13, color: '#6B7280', textDecoration: 'none' }}>
              {link.label}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  )
}
