'use client'

import { useState, useTransition } from 'react'
import { saveCompanySetupStep1 } from './actions'

const FSM_OPTIONS = [
  { value: 'hcp', label: 'Housecall Pro' },
  { value: 'workiz', label: 'Workiz' },
  { value: 'servicetrade', label: 'ServiceTrade' },
  { value: 'jobber', label: 'Jobber' },
  { value: 'other', label: 'Other FSM' },
  { value: 'unknown', label: 'Not using an FSM' },
]

const inputStyle = {
  width: '100%', height: 36,
  border: '0.5px solid var(--color-border-secondary)',
  borderRadius: 6, padding: '0 10px',
  fontSize: 13, color: 'var(--color-text-primary)',
}

export function OnboardingForm({
  defaultName,
  defaultQbType,
  defaultFsm,
  defaultJobCosting,
}: {
  defaultName: string
  defaultQbType: 'qbo' | 'qbd'
  defaultFsm: string
  defaultJobCosting: boolean
}) {
  const [step, setStep] = useState(defaultName ? 3 : 1)  // 1 = welcome, 2 = company setup, 3 = email forwarding
  const [name, setName] = useState(defaultName)
  const [qbType, setQbType] = useState<'qbo' | 'qbd'>(defaultQbType)
  const [fsm, setFsm] = useState(defaultFsm)
  const [jobCosting, setJobCosting] = useState(defaultJobCosting)
  const [nameError, setNameError] = useState('')
  const [isPending, startTransition] = useTransition()

  // Capture address preview (before company is saved, use the name to preview)
  const prefixPreview = name.trim().toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20) || 'yourcompany'

  const handleStep1 = () => {
    if (!name.trim()) {
      setNameError('Company name is required.')
      return
    }
    setNameError('')
    startTransition(async () => {
      const fd = new FormData()
      fd.set('name', name.trim())
      fd.set('qb_type', qbType)
      fd.set('fsm_platform', fsm)
      fd.set('job_costing_enabled', String(jobCosting))
      await saveCompanySetupStep1(fd)
      setStep(3)
    })
  }

  return (
    <>
      {/* Step indicator */}
      <div
        className="flex items-center justify-center gap-2 px-6 py-4"
        style={{ borderBottom: '0.5px solid var(--color-border-tertiary)' }}
      >
        {[1, 2, 3].map(n => (
          <div key={n} className="flex items-center gap-2">
            <div
              style={{
                width: 24, height: 24, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 600,
                background: n < step ? '#2DB87A' : n === step ? '#1A3D2B' : 'var(--color-background-secondary)',
                color: n <= step ? 'white' : 'var(--color-text-tertiary)',
              }}
            >
              {n < step ? <i className="ti ti-check" style={{ fontSize: 11 }} /> : n}
            </div>
            {n < 3 && (
              <div style={{ width: 32, height: 1, background: n < step ? '#2DB87A' : 'var(--color-border-secondary)' }} />
            )}
          </div>
        ))}
      </div>

      <div style={{ padding: '24px 32px' }}>
        {/* Step 1: Welcome — explains what Purchasomatic does before asking any questions */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text-primary)' }}>How Purchasomatic Works</p>
              <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 2 }}>
                Three steps — try it out before you connect QuickBooks.
              </p>
            </div>

            <div className="space-y-3">
              {[
                { icon: 'ti-mail-forward', title: 'Forward or upload an invoice', body: 'Send it to your capture address, or upload a PDF directly — no setup required.' },
                { icon: 'ti-scan', title: 'We extract every line item', body: 'OCR reads the vendor, items, quantities, and totals automatically. You review and correct anything before it moves on.' },
                { icon: 'ti-plug-connected', title: 'Push to QuickBooks when ready', body: 'Connect your QuickBooks account whenever you want — it is not required to start capturing and reviewing invoices.' },
              ].map(s => (
                <div key={s.title} className="flex items-start gap-3">
                  <div
                    style={{
                      width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                      background: '#EBF5EF', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <i className={`ti ${s.icon}`} style={{ fontSize: 16, color: '#1A3D2B' }} />
                  </div>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>{s.title}</p>
                    <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>{s.body}</p>
                  </div>
                </div>
              ))}
            </div>

            <div
              style={{
                background: '#EBF5EF',
                border: '0.5px solid #C3DEC9',
                borderRadius: 8, padding: '12px 16px',
              }}
            >
              <p style={{ fontSize: 12, color: '#1A3D2B' }}>
                <span style={{ fontWeight: 600 }}>No QuickBooks connection needed today.</span>
                {' '}Set up your company, forward a real or sample invoice, and see how Purchasomatic handles it. Connect QuickBooks later, whenever you are ready to publish.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setStep(2)}
              style={{
                width: '100%', background: '#2DB87A', color: 'white',
                borderRadius: 8, padding: '10px', fontSize: 14, fontWeight: 600,
                border: 'none', cursor: 'pointer',
              }}
            >
              Get started
            </button>
          </div>
        )}

        {/* Step 2: Company setup — saves immediately so company exists before QB connect */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text-primary)' }}>Company Setup</p>
              <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 2 }}>Tell us about your business.</p>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>
                Company Name
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Smith HVAC Services"
                style={inputStyle}
              />
              {nameError && <p style={{ fontSize: 11, color: '#DC2626', marginTop: 4 }}>{nameError}</p>}
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 8 }}>
                QuickBooks Version
              </label>
              <div className="grid grid-cols-2 gap-3">
                {(['qbo', 'qbd'] as const).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setQbType(t)}
                    style={{
                      borderRadius: 8, padding: '12px 16px', textAlign: 'left', cursor: 'pointer',
                      border: qbType === t ? '1.5px solid #2DB87A' : '0.5px solid var(--color-border-secondary)',
                      background: qbType === t ? '#EBF5EF' : 'white',
                    }}
                  >
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>
                      {t === 'qbo' ? 'QuickBooks Online' : 'QuickBooks Desktop'}
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>
                      {t === 'qbo' ? 'Connects via OAuth — recommended' : 'Connects via Web Connector'}
                    </p>
                  </button>
                ))}
              </div>
              <p style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 6 }}>
                This just tailors your setup — it does not connect your QuickBooks account. You will connect from Settings whenever you are ready.
              </p>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>
                Field Service Platform <span style={{ fontWeight: 400 }}>(optional)</span>
              </label>
              <select value={fsm} onChange={e => setFsm(e.target.value)} style={{ ...inputStyle }}>
                {FSM_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <p style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 3 }}>
                Helps Purchasomatic match job names from your work orders.
              </p>
            </div>

            <label className="flex items-start gap-3" style={{ cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={jobCosting}
                onChange={e => setJobCosting(e.target.checked)}
                style={{ width: 16, height: 16, marginTop: 2, accentColor: '#2DB87A', flexShrink: 0 }}
              />
              <div>
                <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>Enable job costing</p>
                <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>
                  Assign invoices to QuickBooks jobs for cost tracking. Can be enabled later.
                </p>
              </div>
            </label>

            <button
              type="button"
              onClick={handleStep1}
              disabled={isPending}
              style={{
                width: '100%', background: '#2DB87A', color: 'white',
                borderRadius: 8, padding: '10px', fontSize: 14, fontWeight: 600,
                border: 'none', cursor: isPending ? 'default' : 'pointer',
                opacity: isPending ? 0.7 : 1,
              }}
            >
              {isPending ? 'Saving…' : 'Continue'}
            </button>
          </div>
        )}

        {/* Step 3: Email forwarding */}
        {step === 3 && (
          <div className="space-y-4">
            <div>
              <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text-primary)' }}>Email Forwarding</p>
              <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 2 }}>
                Forward vendor invoices to Purchasomatic for automatic capture.
              </p>
            </div>

            <div
              style={{
                background: '#EBF5EF',
                border: '0.5px solid #C3DEC9',
                borderRadius: 8, padding: '12px 16px',
              }}
            >
              <p style={{ fontSize: 11, fontWeight: 600, color: '#1A3D2B', marginBottom: 4 }}>
                Your capture address for invoices
              </p>
              <p style={{ fontFamily: 'monospace', fontSize: 13, color: '#1A3D2B', wordBreak: 'break-all' }}>
                {prefixPreview}-bills@purchasomatic.com
              </p>
            </div>

            <div
              style={{
                background: 'var(--color-background-secondary)',
                border: '0.5px solid var(--color-border-tertiary)',
                borderRadius: 8, padding: '12px 16px',
              }}
            >
              <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 8 }}>
                To set up forwarding:
              </p>
              {[
                'Log in to your email provider (Gmail, Outlook, etc.)',
                'Set up a forwarding rule: emails with "invoice" in the subject → forward to the address above',
                'Ask your vendors to email invoices to you as usual — Purchasomatic handles the rest',
              ].map((s, i) => (
                <p key={i} style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 6 }}>
                  {i + 1}. {s}
                </p>
              ))}
            </div>

            <p style={{ fontSize: 11, color: 'var(--color-text-tertiary)', textAlign: 'center' }}>
              You can also upload PDFs directly — no need to set up forwarding right away.
            </p>

            <a
              href="/bills"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: '100%', background: '#2DB87A', color: 'white',
                borderRadius: 8, padding: '10px', fontSize: 14, fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              Start capturing invoices →
            </a>

            <a
              href="/settings"
              style={{
                display: 'block', textAlign: 'center',
                fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)',
                textDecoration: 'none',
              }}
            >
              Or connect QuickBooks now →
            </a>
          </div>
        )}
      </div>
    </>
  )
}
