'use client'

import { useState } from 'react'
import { saveCompanySetup } from './actions'

const FSM_OPTIONS = [
  { value: 'hcp', label: 'Housecall Pro' },
  { value: 'workiz', label: 'Workiz' },
  { value: 'servicetrade', label: 'ServiceTrade' },
  { value: 'jobber', label: 'Jobber' },
  { value: 'other', label: 'Other FSM' },
  { value: 'unknown', label: 'Not using an FSM' },
]

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
  const [step, setStep] = useState(1)
  const [name, setName] = useState(defaultName)
  const [qbType, setQbType] = useState<'qbo' | 'qbd'>(defaultQbType)
  const [fsm, setFsm] = useState(defaultFsm)
  const [jobCosting, setJobCosting] = useState(defaultJobCosting)
  const [nameError, setNameError] = useState('')

  const handleNext = () => {
    if (step === 1) {
      if (!name.trim()) {
        setNameError('Company name is required.')
        return
      }
      setNameError('')
    }
    setStep(s => s + 1)
  }

  return (
    <>
      {/* Step indicator */}
      <div className="flex items-center justify-center gap-2 border-b border-gray-100 px-6 py-4">
        {[1, 2, 3].map(n => (
          <div key={n} className="flex items-center gap-2">
            <div
              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                n < step
                  ? 'bg-green-500 text-white'
                  : n === step
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-400'
              }`}
            >
              {n < step ? '✓' : n}
            </div>
            {n < 3 && <div className={`h-px w-8 ${n < step ? 'bg-green-400' : 'bg-gray-200'}`} />}
          </div>
        ))}
      </div>

      <div className="px-8 py-7">
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Company Setup</h2>
              <p className="mt-0.5 text-sm text-gray-500">Tell us about your business.</p>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Company Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Smith HVAC Services"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {nameError && <p className="mt-1 text-xs text-red-500">{nameError}</p>}
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">QuickBooks Version</label>
              <div className="grid grid-cols-2 gap-3">
                {(['qbo', 'qbd'] as const).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setQbType(t)}
                    className={`rounded-lg border-2 px-4 py-3 text-left transition-colors ${
                      qbType === t
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className="text-sm font-semibold text-gray-900">
                      {t === 'qbo' ? 'QuickBooks Online' : 'QuickBooks Desktop'}
                    </div>
                    <div className="mt-0.5 text-xs text-gray-500">
                      {t === 'qbo' ? 'Connects via OAuth — recommended' : 'Connects via Web Connector'}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Field Service Platform (optional)</label>
              <select
                value={fsm}
                onChange={e => setFsm(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {FSM_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-400">Helps Purchasomatic match job names from your work orders.</p>
            </div>

            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={jobCosting}
                onChange={e => setJobCosting(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <p className="text-sm font-medium text-gray-700">Enable job costing</p>
                <p className="text-xs text-gray-400">Assign line items to QuickBooks jobs for cost tracking.</p>
              </div>
            </label>

            <button
              type="button"
              onClick={handleNext}
              className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
            >
              Continue
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Connect QuickBooks</h2>
              <p className="mt-0.5 text-sm text-gray-500">
                {qbType === 'qbo'
                  ? 'Connect your QuickBooks Online company to sync vendors, jobs, and push bills.'
                  : 'Set up the QuickBooks Web Connector to sync with QuickBooks Desktop.'}
              </p>
            </div>

            {qbType === 'qbo' ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-gray-200 bg-gray-50 px-5 py-4">
                  <p className="text-sm text-gray-700 font-medium">QuickBooks Online</p>
                  <p className="mt-1 text-xs text-gray-500">You&apos;ll be redirected to Intuit to authorize Purchasomatic. This takes about 30 seconds.</p>
                </div>
                <a
                  href="/api/quickbooks/connect"
                  className="flex w-full items-center justify-center rounded-lg bg-[#2ca01c] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#248017] transition-colors"
                >
                  Connect QuickBooks Online
                </a>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="w-full text-sm text-gray-400 hover:text-gray-600 transition-colors"
                >
                  Skip for now
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-xl border border-gray-200 bg-gray-50 px-5 py-4 space-y-2">
                  <p className="text-sm font-medium text-gray-700">Setup Instructions</p>
                  <ol className="space-y-1.5 text-xs text-gray-600 list-decimal list-inside">
                    <li>Download and install the QuickBooks Web Connector on your QB Desktop computer</li>
                    <li>Download your Purchasomatic .QWC config file (button below)</li>
                    <li>In QuickBooks Desktop, go to File → App Center → Update Web Services</li>
                    <li>Add the .QWC file and enter your Purchasomatic password</li>
                  </ol>
                </div>
                <a
                  href="/api/quickbooks/qbd-config"
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Download .QWC Config File
                </a>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
                >
                  Continue
                </button>
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <form action={saveCompanySetup} className="space-y-5">
            <input type="hidden" name="name" value={name} />
            <input type="hidden" name="qb_type" value={qbType} />
            <input type="hidden" name="fsm_platform" value={fsm} />
            <input type="hidden" name="job_costing_enabled" value={String(jobCosting)} />

            <div>
              <h2 className="text-base font-semibold text-gray-900">Email Forwarding</h2>
              <p className="mt-0.5 text-sm text-gray-500">Forward vendor invoices to Purchasomatic for automatic capture.</p>
            </div>

            <div className="rounded-xl border border-blue-100 bg-blue-50 px-5 py-4">
              <p className="text-xs font-medium text-blue-700 mb-1">Your Purchasomatic capture address</p>
              <p className="font-mono text-sm text-blue-900 break-all">
                <span className="font-semibold">{name.trim().toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20) || 'yourcompany'}</span>@purchasomatic.app
              </p>
            </div>

            <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-xs text-gray-600 space-y-1.5">
              <p className="font-medium text-gray-700">To set up forwarding:</p>
              <p>1. Log in to your email provider (Gmail, Outlook, etc.)</p>
              <p>2. Set up a forwarding rule: emails with &quot;invoice&quot; in the subject → forward to the address above</p>
              <p>3. Ask your vendors to email invoices to you as usual — Purchasomatic handles the rest</p>
            </div>

            <button
              type="submit"
              className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
            >
              Finish Setup →
            </button>
          </form>
        )}
      </div>
    </>
  )
}
