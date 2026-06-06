import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Terms of Service — Purchasomatic',
}

const EFFECTIVE_DATE = 'June 5, 2026'
const CONTACT_EMAIL  = 'support@purchasomatic.com'
const OWNER_NAME     = 'Heather Dillon'
const APP_NAME       = 'Purchasomatic'

export default function TermsPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#F9FAFB' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '48px 24px 80px' }}>

        {/* Header */}
        <div style={{ marginBottom: 40 }}>
          <Link
            href="/"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 32, textDecoration: 'none' }}
          >
            <div style={{ width: 28, height: 28, background: '#2DB87A', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="ti ti-file-invoice" style={{ fontSize: 15, color: 'white' }} />
            </div>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#1A3D2B' }}>{APP_NAME}</span>
          </Link>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#111827', marginBottom: 8 }}>Terms of Service</h1>
          <p style={{ fontSize: 14, color: '#6B7280' }}>Effective date: {EFFECTIVE_DATE}</p>
        </div>

        <div style={{ background: 'white', borderRadius: 12, border: '1px solid #E5E7EB', padding: '40px 48px', fontSize: 15, lineHeight: 1.7, color: '#374151' }}>

          <Section title="1. Acceptance of Terms">
            <p>
              By creating an account or using {APP_NAME} (&ldquo;the Service&rdquo;), you agree to be bound by these Terms of Service. If you do not agree, do not use the Service. These terms constitute a binding agreement between you and {OWNER_NAME} (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;).
            </p>
          </Section>

          <Section title="2. Description of Service">
            <p>
              {APP_NAME} is a software-as-a-service application that automates vendor invoice and purchase order capture, data extraction via optical character recognition and AI, and synchronization with QuickBooks Online and QuickBooks Desktop. The Service is intended for use by businesses and is not a consumer product.
            </p>
          </Section>

          <Section title="3. Accounts and Access">
            <p>
              You are responsible for maintaining the confidentiality of your account credentials and for all activity that occurs under your account. You must provide accurate and complete information when creating your account and keep it up to date. You may not share your account with others or create accounts on behalf of third parties without their consent.
            </p>
            <p style={{ marginTop: 12 }}>
              You must be at least 18 years old and have the authority to bind your organization to these terms in order to use the Service.
            </p>
          </Section>

          <Section title="4. Credits and Payment">
            <p>
              {APP_NAME} operates on a credit-based model. Credits are consumed when the Service processes invoices or purchase orders. Current credit costs are displayed within the application and may be updated with 14 days&rsquo; notice.
            </p>
            <p style={{ marginTop: 12 }}>
              Credits are purchased in advance through our billing system. Credits are non-refundable except where required by law. Credits do not expire while your account remains active. We do not charge credits for reprocessing, duplicate documents, or documents rejected due to wrong capture address.
            </p>
            <p style={{ marginTop: 12 }}>
              All payments are processed by Stripe and are subject to Stripe&rsquo;s terms of service. We do not store your payment card details.
            </p>
          </Section>

          <Section title="5. Acceptable Use">
            <p>You agree not to:</p>
            <ul style={{ paddingLeft: 20, marginTop: 8 }}>
              <li style={{ marginBottom: 6 }}>Use the Service for any unlawful purpose or in violation of any regulations</li>
              <li style={{ marginBottom: 6 }}>Upload documents you do not have the legal right to process</li>
              <li style={{ marginBottom: 6 }}>Attempt to reverse engineer, decompile, or extract source code from the Service</li>
              <li style={{ marginBottom: 6 }}>Use the Service to process documents on behalf of third parties as a reseller or bureau service without a separate written agreement</li>
              <li style={{ marginBottom: 6 }}>Attempt to exceed rate limits, circumvent security measures, or interfere with the Service&rsquo;s operation</li>
              <li style={{ marginBottom: 6 }}>Use the Service to submit fraudulent or fabricated documents</li>
            </ul>
          </Section>

          <Section title="6. QuickBooks Integration">
            <p>
              Use of the QuickBooks integration requires a valid QuickBooks Online or QuickBooks Desktop subscription and is subject to Intuit&rsquo;s terms of service. We are an independent application and are not affiliated with, endorsed by, or sponsored by Intuit Inc. You are solely responsible for your QuickBooks account and the accuracy of data pushed to it through {APP_NAME}.
            </p>
          </Section>

          <Section title="7. Data and Privacy">
            <p>
              Your use of the Service is also governed by our{' '}
              <Link href="/privacy" style={{ color: '#2DB87A' }}>Privacy Policy</Link>,
              which is incorporated into these terms by reference. You retain ownership of all data you submit to the Service. You grant us a limited license to process that data solely to provide the Service to you.
            </p>
            <p style={{ marginTop: 12 }}>
              You are responsible for ensuring you have the right to submit documents and data to the Service, including any vendor invoices forwarded to your capture addresses.
            </p>
          </Section>

          <Section title="8. Intellectual Property">
            <p>
              The Service, including its software, design, and content, is owned by {OWNER_NAME} and protected by copyright and other intellectual property laws. These terms do not transfer any ownership rights to you. You may not copy, modify, or create derivative works from the Service.
            </p>
            <p style={{ marginTop: 12 }}>
              Vendor format knowledge learned from processing documents may be used to improve extraction accuracy across all customers on the platform. This knowledge is owned by {OWNER_NAME} and does not constitute your confidential information.
            </p>
          </Section>

          <Section title="9. Service Availability">
            <p>
              We aim to maintain high availability but do not guarantee uninterrupted access to the Service. We may perform scheduled maintenance, release updates, or experience outages beyond our control. We will make reasonable efforts to notify you of planned downtime in advance.
            </p>
            <p style={{ marginTop: 12 }}>
              We reserve the right to modify or discontinue features of the Service at any time with reasonable notice.
            </p>
          </Section>

          <Section title="10. Disclaimer of Warranties">
            <p>
              THE SERVICE IS PROVIDED &ldquo;AS IS&rdquo; WITHOUT WARRANTY OF ANY KIND. WE EXPRESSLY DISCLAIM ALL WARRANTIES, WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
            </p>
            <p style={{ marginTop: 12 }}>
              We do not warrant that the Service will be error-free, that extracted data will be 100% accurate, or that documents pushed to QuickBooks will be free of errors. You are responsible for reviewing all extracted data before approving it for publication to QuickBooks.
            </p>
          </Section>

          <Section title="11. Limitation of Liability">
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, {OWNER_NAME.toUpperCase()} SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOST PROFITS OR DATA, ARISING FROM YOUR USE OF THE SERVICE.
            </p>
            <p style={{ marginTop: 12 }}>
              Our total liability for any claims arising under these terms shall not exceed the amount you paid for the Service in the three months preceding the claim.
            </p>
          </Section>

          <Section title="12. Indemnification">
            <p>
              You agree to indemnify and hold harmless {OWNER_NAME} from any claims, damages, or expenses (including reasonable legal fees) arising from your use of the Service, your violation of these terms, or your violation of any third-party rights.
            </p>
          </Section>

          <Section title="13. Termination">
            <p>
              You may cancel your account at any time from the billing settings. We may suspend or terminate your account if you violate these terms, fail to pay for the Service, or if we discontinue the Service, with reasonable notice where practicable.
            </p>
            <p style={{ marginTop: 12 }}>
              Upon termination, your access to the Service will cease. We will retain your data for 90 days after termination to allow for export, after which it will be deleted in accordance with our Privacy Policy.
            </p>
          </Section>

          <Section title="14. Changes to Terms">
            <p>
              We may update these terms from time to time. We will notify you of material changes by email or in-app notice at least 14 days before they take effect. Continued use of the Service after that date constitutes acceptance of the updated terms.
            </p>
          </Section>

          <Section title="15. Governing Law">
            <p>
              These terms are governed by the laws of the State of Oregon, United States, without regard to conflict of law principles. Any disputes arising under these terms shall be resolved in the state or federal courts located in Washington County, Oregon.
            </p>
          </Section>

          <Section title="16. Contact">
            <p>Questions about these terms:</p>
            <div style={{ marginTop: 12, padding: '16px 20px', background: '#F9FAFB', borderRadius: 8, border: '1px solid #E5E7EB' }}>
              <p style={{ margin: 0, fontWeight: 500 }}>{OWNER_NAME}</p>
              <p style={{ margin: '4px 0 0' }}>
                <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: '#2DB87A' }}>{CONTACT_EMAIL}</a>
              </p>
            </div>
          </Section>

        </div>

        <p style={{ marginTop: 24, textAlign: 'center', fontSize: 13, color: '#9CA3AF' }}>
          &copy; {new Date().getFullYear()} {OWNER_NAME} &middot;{' '}
          <Link href="/privacy" style={{ color: '#9CA3AF' }}>Privacy Policy</Link>
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
