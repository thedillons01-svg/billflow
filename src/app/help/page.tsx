import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Help & Support — Purchasomatic',
  description: 'Setup guides, common questions, and how to get help with Purchasomatic.',
}

const SECTIONS = [
  {
    id: 'getting-started',
    title: 'Getting started',
    articles: [
      {
        id: 'connect-quickbooks',
        title: 'How to connect QuickBooks Online',
        content: [
          'Go to Settings → Integrations. Click Connect QuickBooks Online.',
          'You\'ll be redirected to Intuit\'s login page. Sign in with the account that has admin access to the QuickBooks company you want to connect.',
          'After authorizing, you\'ll be returned to Purchasomatic. Your vendors, jobs, and accounts will sync automatically within a few minutes.',
          'The connection status, last sync time, and a Sync Now button appear in Settings → Integrations. If the sync fails, disconnect and reconnect to force a fresh token.',
        ],
        note: 'QuickBooks Desktop (QBD) support via Web Connector is in development. Email support@purchasomatic.com to be notified when it\'s available.',
      },
      {
        id: 'email-forwarding',
        title: 'How to set up email forwarding',
        content: [
          'Purchasomatic gives you two capture addresses: one for invoices and one for purchase orders. Both are in Settings → Email Capture.',
          'Forward vendor invoices to your invoices address. Forward vendor PO confirmations to your POs address.',
          'You can forward manually, set up automatic forwarding rules in Gmail or Outlook, or give vendors your capture address directly.',
          'When an email arrives, Purchasomatic checks the subject and body. If it looks like a bill, it extracts the PDF and queues it for processing. If it looks like a PO, it routes to the PO inbox.',
          'Sending the wrong document type to the wrong address (e.g., a PO to the bills address) results in a rejection email with no credit charge.',
        ],
        note: null,
      },
      {
        id: 'first-invoice',
        title: 'Processing your first invoice',
        content: [
          'Forward a PDF invoice to your bills capture address. Within a minute or two it will appear in your Bills inbox.',
          'Open it. Purchasomatic shows the PDF on the right and the extracted fields on the left.',
          'Review the vendor name, invoice number, invoice date, total, and line items. Correct anything the OCR got wrong.',
          'Assign a QuickBooks job to any line items that need it. Assign GL accounts if they aren\'t already populated.',
          'When everything looks right, click Publish to QuickBooks. Purchasomatic creates the bill in QuickBooks and moves the invoice to your archive.',
        ],
        note: 'Your 25 trial credits cover the first 25 invoices or POs at no charge.',
      },
    ],
  },
  {
    id: 'invoices-and-pos',
    title: 'Invoices and purchase orders',
    articles: [
      {
        id: 'credit-usage',
        title: 'What uses a credit',
        content: [
          '1 credit per successfully processed invoice or purchase order. Line item extraction is always included — there is no extra charge for it.',
          'Reprocessing an invoice: free. Re-running OCR or reapplying vendor defaults does not use a credit.',
          'Duplicate detected: free. Purchasomatic holds it for review and flags the original.',
          'Wrong document type: free. The email is rejected before processing begins.',
        ],
        note: null,
      },
      {
        id: 'vendor-matching',
        title: 'How vendor matching works',
        content: [
          'When an invoice arrives, Purchasomatic tries to match the extracted vendor name to one of your QuickBooks vendors using a four-tier lookup.',
          'Tier 1: exact match against your known vendor aliases and name variants.',
          'Tier 2: fuzzy name match against your Purchasomatic vendor list.',
          'Tier 3: keyword search — Purchasomatic breaks the vendor name into keywords and looks for a vendor that uniquely matches.',
          'Tier 4: QuickBooks vendor cache — if a QB vendor record matches, Purchasomatic creates a Purchasomatic vendor stub linked to it.',
          'If no match is found, the invoice appears in the inbox with a "Create vendor" prompt. Once you create or link the vendor, future invoices from the same sender match automatically.',
        ],
        note: null,
      },
      {
        id: 'job-matching',
        title: 'How job matching works',
        content: [
          'Purchasomatic looks for a job reference in the invoice — typically in the PO number, reference, or notes fields that vendors include on their invoices.',
          'It matches that reference against your open QuickBooks jobs by job number, job name, and customer name.',
          'When a match is found, all line items on that invoice are pre-assigned to the matched job. You can change individual line items if needed.',
          'If no job is found and the vendor has "Hold for job match" enabled, the invoice status becomes Pending Job Match. Purchasomatic retries every 2 hours during business hours (7 am–7 pm local time). You can also trigger a manual retry from the invoice.',
          'Job assignment is always at the line item level — one line can go to one job, another line to a different job. This mirrors how QuickBooks handles bills.',
        ],
        note: null,
      },
      {
        id: 'auto-publish',
        title: 'Auto-publish',
        content: [
          'Auto-publish pushes invoices to QuickBooks automatically without any manual review.',
          'It\'s per-vendor and is OFF by default. Purchasomatic will suggest enabling it after a vendor has 5 accurate invoices.',
          'For auto-publish to fire, all of these must be true: vendor is set, all line items have a GL account, line item total matches the invoice header total, a job match was found (if required), no duplicate, and no QB sync errors on recent invoices.',
          'If auto-publish doesn\'t fire, Purchasomatic shows a plain-language reason on the invoice in the inbox — e.g., "Line item total doesn\'t match invoice total ($1,248.00 vs $1,250.00)."',
          'Auto-publish disables automatically if a QB error is found on a recently auto-published bill. You\'ll receive an error notification.',
        ],
        note: null,
      },
      {
        id: 'po-workflow',
        title: 'Purchase order workflow',
        content: [
          'Forward a vendor PO confirmation to your POs capture address. Purchasomatic creates a QuickBooks Purchase Order record.',
          'When the invoice for that PO arrives via the bills address, Purchasomatic tries to match it to the open PO by vendor and PO number.',
          'If matched, the bill is linked to the PO in QuickBooks and any quantity or price discrepancies are flagged for review.',
          'You can also use the receiving workflow to mark items as received line by line before the invoice arrives.',
        ],
        note: null,
      },
    ],
  },
  {
    id: 'vendors',
    title: 'Vendor settings',
    articles: [
      {
        id: 'vendor-defaults',
        title: 'Setting vendor default GL accounts',
        content: [
          'Open a vendor record and go to the General tab. The Default GL Account field sets the QuickBooks expense account that pre-populates every line item from this vendor.',
          'When you change a GL account on a line item during review, Purchasomatic asks "Remember this for future invoices from [Vendor]?" Clicking Yes saves it as the vendor default.',
          'The GL account source for each line item is shown as a badge: QB (from QuickBooks vendor defaults), Purchasomatic (set in Purchasomatic), Rule (matched a routing rule), Stored (remembered from a previous invoice), or Manual (set on this invoice only).',
        ],
        note: null,
      },
      {
        id: 'line-item-rules',
        title: 'Line item routing rules',
        content: [
          'Rules automatically assign a GL account to a line item based on its description.',
          'Go to a vendor record → Line Items tab to create rules. Each rule has a condition (Description contains / begins with / ends with / equals [text]) and an action (assign GL account or QB Product/Service).',
          'Rules are evaluated after stored mappings. If a stored mapping and a rule both match, the rule wins.',
        ],
        note: null,
      },
    ],
  },
  {
    id: 'troubleshooting',
    title: 'Troubleshooting',
    articles: [
      {
        id: 'invoice-not-arriving',
        title: 'Invoice forwarded but not appearing in the inbox',
        content: [
          'Check your email client\'s sent folder to confirm the forward was sent.',
          'Make sure the email included a PDF attachment. Purchasomatic does not process HTML-only emails.',
          'Check that the forwarding address is correct — it appears in Settings → Email Capture. The bills address ends in -bills@purchasomatic.com.',
          'If the subject or body doesn\'t contain the word "invoice", Purchasomatic may have rejected it. You\'ll receive a rejection email at the address you forwarded from.',
          'If none of these apply, contact support@purchasomatic.com with the email subject and sender.',
        ],
        note: null,
      },
      {
        id: 'ocr-errors',
        title: 'OCR got the wrong numbers',
        content: [
          'On the invoice review screen, click any field to edit it directly. You can also click a region on the PDF to run targeted OCR on that area and copy it to the clipboard.',
          'If a vendor\'s invoices consistently extract incorrectly, contact support@purchasomatic.com with a sample PDF. Purchasomatic learns vendor PDF formats platform-wide, so once a vendor is calibrated, accuracy improves for all customers.',
        ],
        note: null,
      },
      {
        id: 'qb-sync-error',
        title: 'QuickBooks sync error on a bill',
        content: [
          'Open the bill in the inbox. The sync error message shows the specific reason QuickBooks rejected the bill.',
          'Common causes: the vendor doesn\'t exist in QuickBooks, the GL account is inactive, the job was closed, or the bill date is in a locked period.',
          'Fix the underlying issue in QuickBooks, then click Publish again. Purchasomatic will retry the push.',
          'Bills with Sync Error status can be unpublished from the review screen — this returns them to Ready status so you can fix and re-publish.',
        ],
        note: null,
      },
      {
        id: 'disconnect-reconnect',
        title: 'Reconnecting QuickBooks after a token error',
        content: [
          'Go to Settings → Integrations. Click Disconnect next to QuickBooks Online.',
          'Click Connect QuickBooks Online and complete the authorization flow again.',
          'Your data is not deleted when you disconnect — only the OAuth token is cleared.',
          'After reconnecting, click Sync Now to refresh your vendor, job, and account lists.',
        ],
        note: null,
      },
    ],
  },
]

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: 'var(--font-geist-sans), system-ui, sans-serif' }}>
      <Nav />

      {/* Hero */}
      <section style={{ background: '#1A3D2B', padding: '80px 24px 88px' }}>
        <div style={{ maxWidth: 680, margin: '0 auto', textAlign: 'center' }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#2DB87A', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 14 }}>
            Help & Support
          </p>
          <h1 style={{ fontSize: 'clamp(30px, 5vw, 48px)', fontWeight: 700, color: 'white', letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: 18 }}>
            How can we help?
          </h1>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.7)', lineHeight: 1.65, maxWidth: 500, margin: '0 auto 28px' }}>
            Guides, common questions, and how to reach us.
          </p>
          <a
            href="mailto:support@purchasomatic.com"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.85)',
              border: '1px solid rgba(255,255,255,0.2)',
              fontSize: 14, fontWeight: 500,
              padding: '9px 20px', borderRadius: 8, textDecoration: 'none',
            }}
          >
            <i className="ti ti-mail" style={{ fontSize: 15 }} />
            support@purchasomatic.com
          </a>
        </div>
      </section>

      {/* Main content */}
      <section style={{ padding: '72px 24px 96px' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', gap: 48, alignItems: 'flex-start' }}>
          {/* Sidebar nav */}
          <aside style={{ width: 200, flexShrink: 0, position: 'sticky', top: 80 }}>
            <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {SECTIONS.map(section => (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  style={{ fontSize: 13, fontWeight: 500, color: '#6B7280', textDecoration: 'none', padding: '4px 0' }}
                >
                  {section.title}
                </a>
              ))}
            </nav>
          </aside>

          {/* Article content */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {SECTIONS.map((section, si) => (
              <div key={section.id} id={section.id} style={{ marginBottom: si < SECTIONS.length - 1 ? 64 : 0 }}>
                <h2 style={{
                  fontSize: 13, fontWeight: 700, color: '#2DB87A', letterSpacing: '0.07em',
                  textTransform: 'uppercase', marginBottom: 24,
                  paddingBottom: 10, borderBottom: '1px solid #F3F4F6',
                }}>
                  {section.title}
                </h2>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
                  {section.articles.map(article => (
                    <div key={article.id} id={article.id}>
                      <h3 style={{ fontSize: 17, fontWeight: 600, color: '#111827', marginBottom: 14 }}>
                        {article.title}
                      </h3>
                      <ol style={{ paddingLeft: 20, margin: 0 }}>
                        {article.content.map((step, i) => (
                          <li
                            key={i}
                            style={{ fontSize: 14, color: '#374151', lineHeight: 1.7, marginBottom: 10 }}
                          >
                            {step}
                          </li>
                        ))}
                      </ol>
                      {article.note && (
                        <div style={{
                          marginTop: 14,
                          background: '#EBF5EF', border: '1px solid #C6E8D5',
                          borderRadius: 8, padding: '10px 14px',
                          fontSize: 13, color: '#2D6B4B', lineHeight: 1.6,
                        }}>
                          <strong>Note:</strong> {article.note}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact CTA */}
      <section style={{ padding: '64px 24px', background: '#F9FAFB', borderTop: '1px solid #E5E7EB' }}>
        <div style={{ maxWidth: 600, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: 'clamp(22px, 3vw, 30px)', fontWeight: 700, color: '#111827', letterSpacing: '-0.02em', marginBottom: 12 }}>
            Still need help?
          </h2>
          <p style={{ fontSize: 15, color: '#6B7280', lineHeight: 1.65, marginBottom: 28 }}>
            Email us and we&apos;ll get back to you within one business day.
            For time-sensitive issues, put <strong>URGENT</strong> in the subject line.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a
              href="mailto:support@purchasomatic.com"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                background: '#2DB87A', color: 'white',
                fontSize: 14, fontWeight: 600,
                padding: '11px 24px', borderRadius: 8, textDecoration: 'none',
              }}
            >
              <i className="ti ti-mail" style={{ fontSize: 15 }} />
              support@purchasomatic.com
            </a>
            <Link
              href="/signup"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                background: 'white', color: '#1A3D2B',
                border: '1px solid #D1D5DB',
                fontSize: 14, fontWeight: 600,
                padding: '11px 24px', borderRadius: 8, textDecoration: 'none',
              }}
            >
              Start free trial
            </Link>
          </div>
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
          <Link href="/pricing" style={{ fontSize: 14, fontWeight: 500, color: '#4B5563', textDecoration: 'none', padding: '6px 14px' }}>
            Pricing
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
