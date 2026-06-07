import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Privacy Policy — Purchasomatic',
}

const EFFECTIVE_DATE = 'June 7, 2026'
const CONTACT_EMAIL  = 'privacy@purchasomatic.com'
const COMPANY_NAME   = 'Heather Dillon'
const APP_NAME       = 'Purchasomatic'

export default function PrivacyPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#F9FAFB' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '48px 24px 80px' }}>

        {/* Header */}
        <div style={{ marginBottom: 40 }}>
          <Link
            href="/"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 32, textDecoration: 'none' }}
          >
            <img src="/logo-28.png" alt="Purchasomatic" style={{ width: 28, height: 28 }} />
            <span style={{ fontSize: 15, fontWeight: 700, color: '#1A3D2B' }}>{APP_NAME}</span>
          </Link>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#111827', marginBottom: 8 }}>Privacy Policy</h1>
          <p style={{ fontSize: 14, color: '#6B7280' }}>Effective date: {EFFECTIVE_DATE}</p>
        </div>

        <div style={{ background: 'white', borderRadius: 12, border: '1px solid #E5E7EB', padding: '40px 48px', fontSize: 15, lineHeight: 1.7, color: '#374151' }}>

          <Section title="1. Who We Are">
            <p>
              {APP_NAME} is a software service operated by {COMPANY_NAME} (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;). {APP_NAME} automates vendor invoice capture, data extraction, and QuickBooks synchronization for contractors and small businesses.
            </p>
            <p style={{ marginTop: 12 }}>
              If you have questions about this policy, contact us at{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: '#2DB87A' }}>{CONTACT_EMAIL}</a>.
            </p>
          </Section>

          <Section title="2. Information We Collect">
            <SubHeading>Account information</SubHeading>
            <p>When you create an account we collect your name, email address, and company name.</p>

            <SubHeading>Invoice and purchase order data</SubHeading>
            <p>
              When vendor invoices or purchase orders are forwarded to your {APP_NAME} capture address, we receive and process the email content including attachments. We extract structured data from those documents — vendor names, invoice numbers, dates, line item descriptions, quantities, and amounts — using optical character recognition (OCR) and AI-assisted extraction.
            </p>

            <SubHeading>QuickBooks data</SubHeading>
            <p>
              When you connect {APP_NAME} to QuickBooks Online or QuickBooks Desktop, we sync and cache a subset of your QuickBooks data to enable matching and bill creation. This includes vendor names, chart of accounts, job and customer names, and payment terms. We access only the data necessary to provide the service and do not read or store your QuickBooks payroll, employee, or personal financial data.
            </p>

            <SubHeading>Usage and activity data</SubHeading>
            <p>
              We log actions taken within the application — invoices processed, bills published, credits used — to power the activity log, support troubleshooting, and maintain accurate credit balances.
            </p>

            <SubHeading>Technical data</SubHeading>
            <p>
              We collect standard web server logs including IP addresses, browser type, and pages visited for security monitoring and debugging purposes. We do not use third-party analytics tracking.
            </p>
          </Section>

          <Section title="3. How We Use Your Information">
            <ul style={{ paddingLeft: 20, marginTop: 0 }}>
              <li style={{ marginBottom: 8 }}>To provide and operate the {APP_NAME} service — extracting invoice data, matching to QuickBooks records, and pushing approved bills to QuickBooks</li>
              <li style={{ marginBottom: 8 }}>To send transactional notifications — processing confirmations, sync errors, and credit balance alerts</li>
              <li style={{ marginBottom: 8 }}>To maintain your account, process billing, and provide customer support</li>
              <li style={{ marginBottom: 8 }}>To improve extraction accuracy over time using anonymized document format patterns (vendor format knowledge is shared across customers to improve accuracy for all)</li>
              <li style={{ marginBottom: 8 }}>To detect and prevent fraud, abuse, or violations of our Terms of Service</li>
            </ul>
            <p>We do not sell your data. We do not use your invoice or business data for advertising.</p>
          </Section>

          <Section title="4. How We Share Your Information">
            <p>We share your information only in the following circumstances:</p>

            <SubHeading>Service providers</SubHeading>
            <p>We use the following sub-processors to deliver the service:</p>
            <ul style={{ paddingLeft: 20, marginTop: 8 }}>
              <li style={{ marginBottom: 6 }}><strong>Supabase</strong> — database and file storage (United States)</li>
              <li style={{ marginBottom: 6 }}><strong>Vercel</strong> — application hosting (United States)</li>
              <li style={{ marginBottom: 6 }}><strong>Anthropic</strong> — AI-powered text and document extraction (United States)</li>
              <li style={{ marginBottom: 6 }}><strong>Resend</strong> — transactional email delivery (United States)</li>
              <li style={{ marginBottom: 6 }}><strong>Stripe</strong> — payment processing (United States)</li>
              <li style={{ marginBottom: 6 }}><strong>Intuit</strong> — QuickBooks API integration (United States)</li>
            </ul>
            <p style={{ marginTop: 12 }}>Each provider is bound by data processing agreements and may not use your data for their own purposes.</p>

            <SubHeading>Legal requirements</SubHeading>
            <p>We may disclose your information if required by law, court order, or to protect the rights, property, or safety of {COMPANY_NAME}, our customers, or the public.</p>

            <SubHeading>Business transfers</SubHeading>
            <p>If {COMPANY_NAME} is acquired or merges with another entity, your information may be transferred as part of that transaction. We will notify you before your data becomes subject to a different privacy policy.</p>
          </Section>

          <Section title="5. QuickBooks Integration and Data Access">
            <p>
              {APP_NAME} integrates with Intuit QuickBooks Online via the Intuit QuickBooks API, operating under Intuit&rsquo;s developer platform terms. When you connect your QuickBooks account, you authorize {APP_NAME} to read and write data on your behalf within the scopes you approve. This section describes exactly what data we access and why.
            </p>

            <SubHeading>Data we read from QuickBooks</SubHeading>
            <ul style={{ paddingLeft: 20, marginTop: 4 }}>
              <li style={{ marginBottom: 6 }}><strong>Vendors</strong> — vendor names, default expense accounts, and payment terms, used to match incoming invoices to the correct QuickBooks vendor record</li>
              <li style={{ marginBottom: 6 }}><strong>Chart of accounts</strong> — expense and cost-of-goods-sold account names and IDs, used to populate the GL account selection on bill line items</li>
              <li style={{ marginBottom: 6 }}><strong>Customers and jobs</strong> — customer and sub-customer (job) names and IDs, used to match invoices and purchase orders to the correct job for cost coding</li>
              <li style={{ marginBottom: 6 }}><strong>Classes</strong> — class names and IDs (if class tracking is enabled in your QuickBooks company), used for bill line item classification</li>
              <li style={{ marginBottom: 6 }}><strong>Payment terms</strong> — vendor payment terms, used to pre-populate bill due dates</li>
            </ul>

            <SubHeading>Data we write to QuickBooks</SubHeading>
            <ul style={{ paddingLeft: 20, marginTop: 4 }}>
              <li style={{ marginBottom: 6 }}><strong>Bills (Accounts Payable)</strong> — we create vendor bill records in QuickBooks from processed invoices, including vendor reference, line items, GL account coding, job coding, and attached PDF</li>
              <li style={{ marginBottom: 6 }}><strong>Purchase orders</strong> — we create purchase order records in QuickBooks from captured PO confirmations</li>
              <li style={{ marginBottom: 6 }}><strong>Bill payments</strong> — when the &ldquo;Mark as Paid&rdquo; feature is enabled, we create a linked bill payment record against the designated payment account</li>
              <li style={{ marginBottom: 6 }}><strong>Vendors</strong> — with your explicit confirmation, we can create new vendor records in QuickBooks for vendors that do not yet exist</li>
              <li style={{ marginBottom: 6 }}><strong>Customers / Jobs</strong> — with your explicit confirmation, we can create new customer or job (sub-customer) records in QuickBooks</li>
            </ul>

            <SubHeading>Data we do not access</SubHeading>
            <p>
              {APP_NAME} does not access, read, or store your QuickBooks payroll data, employee records, banking credentials, bank transaction data, sales invoices, customer payment data, or any personal financial information beyond what is listed above. We request only the minimum OAuth scopes required to deliver the service.
            </p>

            <SubHeading>How your QuickBooks data is stored</SubHeading>
            <p>
              We maintain a local cache of vendor names, account names, and job names to enable fast matching without making a live API call for every action. This cached data is stored in our database and refreshed periodically from QuickBooks. Your QuickBooks OAuth access tokens are stored encrypted in our database and are never transmitted to any party other than Intuit&rsquo;s API servers.
            </p>

            <SubHeading>Revoking access</SubHeading>
            <p>
              You can disconnect {APP_NAME} from your QuickBooks account at any time from the Settings page within {APP_NAME}. This immediately revokes our access token with Intuit and clears all stored credentials. You can also revoke access directly from your Intuit account at{' '}
              <a href="https://accounts.intuit.com" style={{ color: '#2DB87A' }} target="_blank" rel="noopener noreferrer">accounts.intuit.com</a>.
              After disconnection, we retain cached QuickBooks reference data (vendor names, account names, job names) for up to 90 days to preserve your bill history, after which it is deleted. We do not retain any QuickBooks credentials or tokens after disconnection.
            </p>
          </Section>

          <Section title="6. Data Retention">
            <p>
              We retain your account and business data for as long as your account is active. If you close your account, we delete your personal information and business data within 90 days, except where we are required to retain it for legal or financial compliance purposes.
            </p>
            <p style={{ marginTop: 12 }}>
              Invoice PDFs are stored in encrypted cloud storage and are deleted with your account or upon request. Processed invoice records (extracted data) are retained to support your activity history and audit trail.
            </p>
          </Section>

          <Section title="7. Security">
            <p>
              We protect your data using industry-standard measures including encryption in transit (TLS) and at rest, row-level security on our database, and server-side-only handling of API credentials. Access tokens for QuickBooks and other integrations are never exposed to client-side code.
            </p>
            <p style={{ marginTop: 12 }}>
              Despite our efforts, no method of transmission over the internet is 100% secure. If you discover a security vulnerability, please report it to{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: '#2DB87A' }}>{CONTACT_EMAIL}</a>.
            </p>
          </Section>

          <Section title="8. Your Rights">
            <p>Depending on your location, you may have the right to:</p>
            <ul style={{ paddingLeft: 20, marginTop: 8 }}>
              <li style={{ marginBottom: 6 }}>Access the personal information we hold about you</li>
              <li style={{ marginBottom: 6 }}>Correct inaccurate information</li>
              <li style={{ marginBottom: 6 }}>Request deletion of your personal information</li>
              <li style={{ marginBottom: 6 }}>Export your data in a portable format</li>
              <li style={{ marginBottom: 6 }}>Opt out of certain processing activities</li>
            </ul>
            <p style={{ marginTop: 12 }}>
              To exercise any of these rights, contact us at{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: '#2DB87A' }}>{CONTACT_EMAIL}</a>. We will respond within 30 days.
            </p>
          </Section>

          <Section title="9. Cookies">
            <p>
              {APP_NAME} uses cookies strictly for session management and security. We set an authentication cookie when you log in (required for the service to function) and short-lived cookies during the QuickBooks OAuth connection flow. We do not use tracking, advertising, or analytics cookies.
            </p>
          </Section>

          <Section title="10. Children's Privacy">
            <p>
              {APP_NAME} is a business-to-business service not directed at children under 13. We do not knowingly collect personal information from children.
            </p>
          </Section>

          <Section title="11. Changes to This Policy">
            <p>
              We may update this privacy policy from time to time. We will notify you of material changes by email or by posting a notice in the application at least 14 days before the change takes effect. Continued use of the service after that date constitutes acceptance of the updated policy.
            </p>
          </Section>

          <Section title="12. Contact">
            <p>
              For privacy questions, data requests, or concerns:
            </p>
            <div style={{ marginTop: 12, padding: '16px 20px', background: '#F9FAFB', borderRadius: 8, border: '1px solid #E5E7EB' }}>
              <p style={{ margin: 0, fontWeight: 500 }}>{COMPANY_NAME}</p>
              <p style={{ margin: '4px 0 0' }}>
                <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: '#2DB87A' }}>{CONTACT_EMAIL}</a>
              </p>
            </div>
          </Section>

        </div>

        <p style={{ marginTop: 24, textAlign: 'center', fontSize: 13, color: '#9CA3AF' }}>
          &copy; {new Date().getFullYear()} {COMPANY_NAME} &middot;{' '}
          <Link href="/terms" style={{ color: '#9CA3AF' }}>Terms of Service</Link>
          {' '}&middot;{' '}
          <Link href="/" style={{ color: '#9CA3AF' }}>purchasomatic.com</Link>
        </p>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <h2 style={{ fontSize: 17, fontWeight: 600, color: '#111827', marginBottom: 12, marginTop: 0 }}>{title}</h2>
      {children}
    </div>
  )
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontWeight: 600, color: '#111827', marginTop: 16, marginBottom: 4 }}>{children}</p>
  )
}
