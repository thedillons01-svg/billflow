'use client'

import { useState, useTransition } from 'react'
import { updateVendor } from './actions'

type Account = { qb_account_id: string; name: string | null; account_type: string | null }

type Vendor = {
  vendor_id: string
  vendor_name_extracted: string
  vendor_name_display: string | null
  is_visible: boolean
  auto_publish_enabled: boolean
  hold_for_job_match: boolean
  mark_as_paid_default: boolean
  default_description: string | null
  default_payment_account_id: string | null
  default_payment_method: string | null
  billflow_gl_account_id: string | null
  copy_po_to_qb_reference: boolean
  invoices_processed: number
  confidence_display: string | null
}

export function VendorGeneralTab({ vendor, accounts }: { vendor: Vendor; accounts: Account[] }) {
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)

  const [form, setForm] = useState({
    vendor_name_extracted: vendor.vendor_name_extracted,
    vendor_name_display:   vendor.vendor_name_display ?? '',
    is_visible:            vendor.is_visible,
    auto_publish_enabled:  vendor.auto_publish_enabled,
    hold_for_job_match:    vendor.hold_for_job_match,
    mark_as_paid_default:  vendor.mark_as_paid_default,
    default_description:   vendor.default_description ?? '',
    default_payment_account_id: vendor.default_payment_account_id ?? '',
    default_payment_method: vendor.default_payment_method ?? '',
    billflow_gl_account_id: vendor.billflow_gl_account_id ?? '',
    copy_po_to_qb_reference: vendor.copy_po_to_qb_reference,
  })

  const handleSave = () => {
    startTransition(async () => {
      await updateVendor(vendor.vendor_id, {
        vendor_name_extracted:      form.vendor_name_extracted || null,
        vendor_name_display:        form.vendor_name_display || null,
        is_visible:                 form.is_visible,
        auto_publish_enabled:       form.auto_publish_enabled,
        hold_for_job_match:         form.hold_for_job_match,
        mark_as_paid_default:       form.mark_as_paid_default,
        default_description:        form.default_description || null,
        default_payment_account_id: form.default_payment_account_id || null,
        default_payment_method:     form.default_payment_method || null,
        billflow_gl_account_id:     form.billflow_gl_account_id || null,
        gl_account_source:          form.billflow_gl_account_id ? 'billflow_override' : 'not_set',
        copy_po_to_qb_reference:    form.copy_po_to_qb_reference,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    })
  }

  const set = (k: string, v: string | boolean) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div style={{ maxWidth: 600 }} className="space-y-6">
      {/* Names */}
      <Section title="Vendor Names">
        <Field
          label="OCR name (extracted from PDF)"
          helper="The name exactly as it appears on vendor invoices. Used for matching incoming invoices to this vendor record."
        >
          <input
            value={form.vendor_name_extracted}
            onChange={e => set('vendor_name_extracted', e.target.value)}
            style={inputStyle}
          />
        </Field>
        <Field
          label="Display name (QB vendor name)"
          helper="The vendor name as it appears in QuickBooks. Bills are pushed to QB using this name."
        >
          <input
            value={form.vendor_name_display}
            onChange={e => set('vendor_name_display', e.target.value)}
            placeholder="Same as OCR name"
            style={inputStyle}
          />
        </Field>
      </Section>

      {/* GL Account */}
      <Section title="Default GL Account">
        <Field
          label="GL account (BillFlow override)"
          helper="The expense account all line items from this vendor default to. Overrides the QuickBooks vendor default. Source badge on bill review screen shows 'BillFlow' when this is set."
        >
          <select value={form.billflow_gl_account_id} onChange={e => set('billflow_gl_account_id', e.target.value)} style={inputStyle}>
            <option value="">— Use QB vendor default —</option>
            {accounts.map(a => (
              <option key={a.qb_account_id} value={a.qb_account_id}>{a.name}</option>
            ))}
          </select>
        </Field>
        <Field
          label="Default memo / description"
          helper="Pre-populates the QB bill memo field for all invoices from this vendor. Useful for adding job cost codes or notes automatically."
        >
          <input
            value={form.default_description}
            onChange={e => set('default_description', e.target.value)}
            placeholder="e.g. HVAC parts — see attached invoice"
            style={inputStyle}
          />
        </Field>
      </Section>

      {/* Publish settings */}
      <Section title="Publish Settings">
        <ToggleField
          label="Auto-publish enabled"
          helper="When on, invoices from this vendor are automatically pushed to QuickBooks without review — as long as all eligibility checks pass. BillFlow will suggest enabling this after 5 accurate invoices."
          checked={form.auto_publish_enabled}
          onChange={v => set('auto_publish_enabled', v)}
        />
        <ToggleField
          label="Hold for job match"
          helper="When on, bills from this vendor wait in the Pending Job Match queue until a matching job is found in QuickBooks. Only relevant when job costing is enabled."
          checked={form.hold_for_job_match}
          onChange={v => set('hold_for_job_match', v)}
        />
        <ToggleField
          label="Copy PO number to QB reference field"
          helper="When on, the vendor PO / reference number from the invoice is copied to the QuickBooks Ref No field on the bill. Default: on."
          checked={form.copy_po_to_qb_reference}
          onChange={v => set('copy_po_to_qb_reference', v)}
        />
      </Section>

      {/* Mark as Paid */}
      <Section title="Mark as Paid">
        <ToggleField
          label="Mark as paid by default"
          helper="When on, bills from this vendor default to Mark as Paid — meaning they are published to QuickBooks already paid, using the payment account below. Use for vendors you always pay by credit card on order."
          checked={form.mark_as_paid_default}
          onChange={v => set('mark_as_paid_default', v)}
        />
        {form.mark_as_paid_default && (
          <>
            <Field
              label="Default payment account"
              helper="The bank or credit card account the bill payment is posted against in QuickBooks."
            >
              <select value={form.default_payment_account_id} onChange={e => set('default_payment_account_id', e.target.value)} style={inputStyle}>
                <option value="">— Select payment account —</option>
                {accounts.filter(a => ['Bank', 'CreditCard'].includes(a.account_type ?? '')).map(a => (
                  <option key={a.qb_account_id} value={a.qb_account_id}>{a.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Default payment method" helper="Used to set the payment type on the QB bill payment record.">
              <select value={form.default_payment_method} onChange={e => set('default_payment_method', e.target.value)} style={inputStyle}>
                <option value="">— Select —</option>
                <option value="check">Check</option>
                <option value="ach">ACH</option>
                <option value="credit_card">Credit Card</option>
                <option value="other">Other</option>
              </select>
            </Field>
          </>
        )}
      </Section>

      {/* Visibility */}
      <Section title="Visibility">
        <ToggleField
          label="Visible in dropdowns"
          helper="When off, this vendor is hidden from all vendor dropdowns throughout BillFlow without being deleted. Bills already assigned to this vendor are unaffected."
          checked={form.is_visible}
          onChange={v => set('is_visible', v)}
        />
      </Section>

      {/* Stats */}
      <Section title="Processing Stats">
        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
          {vendor.invoices_processed} invoices processed
          {vendor.confidence_display && ` · ${vendor.confidence_display} confidence`}
        </p>
      </Section>

      {/* Save */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={isPending}
          style={{
            background: '#2DB87A', color: 'white',
            borderRadius: 6, padding: '7px 16px',
            fontSize: 13, fontWeight: 500,
            border: 'none', cursor: 'pointer',
            opacity: isPending ? 0.6 : 1,
          }}
        >
          {isPending ? 'Saving…' : 'Save Changes'}
        </button>
        {saved && <span style={{ fontSize: 12, color: '#065F46' }}>Saved ✓</span>}
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', height: 36,
  border: '0.5px solid var(--color-border-secondary)',
  borderRadius: 6, padding: '0 10px',
  fontSize: 13, color: 'var(--color-text-primary)',
  background: 'white',
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-secondary)', marginBottom: 12, paddingTop: 16, borderTop: '0.5px solid var(--color-border-tertiary)' }}>
        {title}
      </p>
      <div className="space-y-4">{children}</div>
    </div>
  )
}

function Field({ label, helper, children }: { label: string; helper: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>{label}</label>
      {children}
      <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 3, lineHeight: 1.5 }}>{helper}</p>
    </div>
  )
}

function ToggleField({ label, helper, checked, onChange }: { label: string; helper: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1">
        <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>{label}</p>
        <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2, lineHeight: 1.5 }}>{helper}</p>
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        style={{
          width: 36, height: 20, borderRadius: 10, border: 'none',
          background: checked ? '#2DB87A' : 'var(--color-border-secondary)',
          cursor: 'pointer', position: 'relative', flexShrink: 0, marginTop: 2,
          transition: 'background 0.2s',
        }}
      >
        <span style={{
          position: 'absolute', top: 2, left: checked ? 18 : 2,
          width: 16, height: 16, borderRadius: '50%', background: 'white',
          boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
          transition: 'left 0.2s',
        }} />
      </button>
    </div>
  )
}
