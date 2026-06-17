'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import { updateVendor, createVendorInQB, applyVendorDefaultToBills } from './actions'
import { useDirty } from '@/components/unsaved-guard'

type Account = { qb_account_id: string; name: string | null; account_type: string | null }
type QBClass = { qb_class_id: string; name: string | null }
type QBVendor = { qb_vendor_id: string; name: string | null }
type QBTerm  = { qb_term_id: string; name: string; due_days: number | null; type: string }
type ApplyField = 'gl_account' | 'class' | 'description' | 'payment_account' | 'payment_method'
type PushPromptState = { state: 'visible' | 'applying' | 'done'; result: string | null }

type Vendor = {
  vendor_id: string
  vendor_name_extracted: string
  vendor_name_display: string | null
  qb_vendor_id: string | null
  is_visible: boolean
  auto_publish_enabled: boolean
  auto_publish_po_enabled: boolean
  hold_for_job_match: boolean
  mark_as_paid_default: boolean
  default_description: string | null
  default_payment_account_id: string | null
  default_payment_method: string | null
  billflow_gl_account_id: string | null
  qb_default_gl_account_id: string | null
  qb_payment_terms: string | null
  billflow_payment_terms: string | null
  payment_terms_source: string | null
  billflow_class_id: string | null
  copy_po_to_qb_reference: boolean
  invoices_processed: number
  pos_processed: number
  confidence_display: string | null
  default_due_date: string | null
}

export function VendorGeneralTab({
  vendor, accounts, classes, classTrackingEnabled, qbVendors, qbTerms = [],
}: {
  vendor: Vendor
  accounts: Account[]
  classes: QBClass[]
  classTrackingEnabled: boolean
  qbVendors: QBVendor[]
  qbTerms?: QBTerm[]
}) {
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)
  const [qbCreateError, setQbCreateError] = useState<string | null>(null)
  const [pushPrompts, setPushPrompts] = useState<Partial<Record<ApplyField, PushPromptState>>>({})
  const { setDirty, registerSaveFn } = useDirty()

  const [form, setForm] = useState({
    vendor_name_extracted: vendor.vendor_name_extracted,
    vendor_name_display:   vendor.vendor_name_display ?? '',
    qb_vendor_id:          vendor.qb_vendor_id ?? '',
    is_visible:            vendor.is_visible,
    auto_publish_enabled:    vendor.auto_publish_enabled,
    auto_publish_po_enabled: vendor.auto_publish_po_enabled,
    hold_for_job_match:      vendor.hold_for_job_match,
    mark_as_paid_default:  vendor.mark_as_paid_default,
    default_description:   vendor.default_description ?? '',
    default_payment_account_id: vendor.default_payment_account_id ?? '',
    default_payment_method: vendor.default_payment_method ?? '',
    billflow_gl_account_id: vendor.billflow_gl_account_id ?? '',
    billflow_payment_terms: vendor.billflow_payment_terms ?? '',
    billflow_class_id: vendor.billflow_class_id ?? '',
    copy_po_to_qb_reference: vendor.copy_po_to_qb_reference,
    default_due_date: vendor.default_due_date ?? 'not_set',
  })

  const saveFnRef = useRef<() => Promise<void>>(async () => {})
  useEffect(() => {
    registerSaveFn(() => saveFnRef.current())
    return () => registerSaveFn(null)
  }, [registerSaveFn])

  saveFnRef.current = async () => {
    const selectedQbVendor = qbVendors.find(v => v.qb_vendor_id === form.qb_vendor_id)
    await updateVendor(vendor.vendor_id, {
      vendor_name_extracted:      form.vendor_name_extracted || null,
      vendor_name_display:        form.vendor_name_display || null,
      qb_vendor_id:               form.qb_vendor_id || null,
      qb_vendor_name:             selectedQbVendor?.name ?? null,
      is_visible:                 form.is_visible,
      auto_publish_enabled:       form.auto_publish_enabled,
      auto_publish_po_enabled:    form.auto_publish_po_enabled,
      hold_for_job_match:         form.hold_for_job_match,
      mark_as_paid_default:       form.mark_as_paid_default,
      default_description:        form.default_description || null,
      default_payment_account_id: form.default_payment_account_id || null,
      default_payment_method:     form.default_payment_method || null,
      billflow_gl_account_id:     form.billflow_gl_account_id || null,
      gl_account_source:          form.billflow_gl_account_id ? 'billflow_override' : vendor.qb_default_gl_account_id ? 'qb_default' : 'not_set',
      billflow_payment_terms:     form.billflow_payment_terms || null,
      payment_terms_source:       form.billflow_payment_terms ? 'billflow_override' : vendor.qb_payment_terms ? 'qb_default' : 'not_set',
      billflow_class_id:          form.billflow_class_id || null,
      class_source:               form.billflow_class_id ? 'Purchasomatic_override' : 'not_set',
      copy_po_to_qb_reference:    form.copy_po_to_qb_reference,
      default_due_date:           form.default_due_date,
    })
    setDirty(false)

    const changed: ApplyField[] = []
    if ((form.billflow_gl_account_id || null) !== (vendor.billflow_gl_account_id || null)) changed.push('gl_account')
    if ((form.billflow_class_id || null) !== (vendor.billflow_class_id || null)) changed.push('class')
    if ((form.default_description || null) !== (vendor.default_description || null)) changed.push('description')
    if ((form.default_payment_account_id || null) !== (vendor.default_payment_account_id || null)) changed.push('payment_account')
    if ((form.default_payment_method || null) !== (vendor.default_payment_method || null)) changed.push('payment_method')

    if (changed.length > 0) {
      const prompts: Partial<Record<ApplyField, PushPromptState>> = {}
      changed.forEach(f => { prompts[f] = { state: 'visible', result: null } })
      setPushPrompts(prompts)
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
  }

  const handleSave = () => {
    startTransition(() => saveFnRef.current())
  }

  const set = (k: string, v: string | boolean) => {
    setForm(f => ({ ...f, [k]: v }))
    setDirty(true)
  }

  async function handleApplyPush(field: ApplyField, mode: 'blank_only' | 'all_unpublished') {
    setPushPrompts(prev => ({ ...prev, [field]: { state: 'applying', result: null } }))
    const r = await applyVendorDefaultToBills(vendor.vendor_id, field, mode)
    const result = r.count === 0
      ? 'No unpublished bills to update.'
      : `Updated ${r.count} bill${r.count !== 1 ? 's' : ''}.`
    setPushPrompts(prev => ({ ...prev, [field]: { state: 'done', result } }))
  }

  function dismissPush(field: ApplyField) {
    setPushPrompts(prev => { const n = { ...prev }; delete n[field]; return n })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const showAutoPublishPromo   = vendor.invoices_processed >= 5 && (vendor.confidence_display === 'high' || vendor.confidence_display === 'medium') && !form.auto_publish_enabled
  const showAutoPublishPoPromo = vendor.pos_processed >= 3 && !form.auto_publish_po_enabled

  return (
    <div style={{ maxWidth: 600 }} className="space-y-6">

      {/* Auto-publish promotion banner */}
      {showAutoPublishPromo && (
        <div
          className="flex items-start gap-3 px-4 py-3"
          style={{ background: '#EBF5EF', border: '1.5px solid #2DB87A', borderRadius: 8 }}
        >
          <i className="ti ti-rocket" style={{ fontSize: 20, color: '#2DB87A', marginTop: 1, flexShrink: 0 }} />
          <div className="flex-1">
            <p style={{ fontSize: 13, fontWeight: 600, color: '#1A3D2B' }}>Ready for auto-publish</p>
            <p style={{ fontSize: 12, color: '#2D6A4F', marginTop: 3, lineHeight: 1.5 }}>
              {vendor.invoices_processed} invoices from this vendor have been processed and recent ones are arriving with all required fields.
              Enable auto-publish and future invoices will flow directly into QuickBooks — no review needed.
            </p>
          </div>
          <button
            onClick={() => set('auto_publish_enabled', true)}
            style={{ background: '#2DB87A', color: 'white', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 12, fontWeight: 500, cursor: 'pointer', flexShrink: 0 }}
          >
            Enable
          </button>
        </div>
      )}

      {/* PO auto-publish promotion banner */}
      {showAutoPublishPoPromo && (
        <div
          className="flex items-start gap-3 px-4 py-3"
          style={{ background: '#EBF5EF', border: '1.5px solid #2DB87A', borderRadius: 8 }}
        >
          <i className="ti ti-rocket" style={{ fontSize: 20, color: '#2DB87A', marginTop: 1, flexShrink: 0 }} />
          <div className="flex-1">
            <p style={{ fontSize: 13, fontWeight: 600, color: '#1A3D2B' }}>Ready for PO auto-publish</p>
            <p style={{ fontSize: 12, color: '#2D6A4F', marginTop: 3, lineHeight: 1.5 }}>
              {vendor.pos_processed} purchase orders from this vendor have been processed.
              Enable PO auto-publish and confirmed orders will flow directly into QuickBooks without review.
            </p>
          </div>
          <button
            onClick={() => set('auto_publish_po_enabled', true)}
            style={{ background: '#2DB87A', color: 'white', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 12, fontWeight: 500, cursor: 'pointer', flexShrink: 0 }}
          >
            Enable
          </button>
        </div>
      )}

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
          label="QuickBooks vendor"
          helper={qbVendors.length === 0 ? "No QB vendors synced yet — connect QuickBooks and run a sync to populate this list." : "Select the matching vendor from your QuickBooks vendor list. This links the vendor for bill publishing and sets the display name."}
        >
          {qbVendors.length === 0 ? (
            <input
              value={form.vendor_name_display}
              onChange={e => set('vendor_name_display', e.target.value)}
              placeholder="QB vendor name"
              style={inputStyle}
            />
          ) : (
            <select
              value={form.qb_vendor_id}
              onChange={e => {
                const selected = qbVendors.find(v => v.qb_vendor_id === e.target.value)
                setForm(f => ({ ...f, qb_vendor_id: e.target.value, vendor_name_display: selected?.name ?? '' }))
                setDirty(true)
              }}
              style={inputStyle}
            >
              <option value="">— Not linked to a QB vendor —</option>
              {qbVendors.map(v => (
                <option key={v.qb_vendor_id} value={v.qb_vendor_id}>{v.name}</option>
              ))}
            </select>
          )}
          {!form.qb_vendor_id && (
            <div style={{ marginTop: 6 }}>
              <button
                type="button"
                disabled={isPending}
                onClick={() => {
                  setQbCreateError(null)
                  startTransition(async () => {
                    const result = await createVendorInQB(vendor.vendor_id)
                    if ('error' in result) {
                      setQbCreateError(result.error)
                    } else {
                      setForm(f => ({ ...f, qb_vendor_id: result.qbVendorId, vendor_name_display: result.qbVendorName }))
                    }
                  })
                }}
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 12, color: '#2DB87A', display: 'flex', alignItems: 'center', gap: 4, opacity: isPending ? 0.6 : 1 }}
              >
                <i className="ti ti-brand-quickbooks" style={{ fontSize: 13 }} />
                {isPending ? 'Creating in QuickBooks…' : `Create "${form.vendor_name_display || vendor.vendor_name_extracted}" in QuickBooks`}
              </button>
              {qbCreateError && (
                <p style={{ fontSize: 11, color: '#991B1B', marginTop: 4 }}>{qbCreateError}</p>
              )}
            </div>
          )}
        </Field>
      </Section>

      {/* GL Account */}
      <Section title="Default GL Account">
        <Field
          label="GL account"
          helper={(() => {
            const qbDefault = accounts.find(a => a.qb_account_id === vendor.qb_default_gl_account_id)
            if (qbDefault) return `QB vendor default: ${qbDefault.name}. Select an account below to override it, or leave blank to use the QB default.`
            if (vendor.qb_default_gl_account_id) return `QB vendor default account ID: ${vendor.qb_default_gl_account_id} (not in synced accounts). Select an account below to override.`
            return 'No default expense account is set on this vendor in QuickBooks. Select an account here so line items have a GL account when invoices are processed.'
          })()}
          footer={pushPrompts.gl_account && (
            <PushPrompt
              prompt={pushPrompts.gl_account}
              onApply={mode => handleApplyPush('gl_account', mode)}
              onSkip={() => dismissPush('gl_account')}
            />
          )}
        >
          <select value={form.billflow_gl_account_id} onChange={e => set('billflow_gl_account_id', e.target.value)} style={inputStyle}>
            <option value="">— Use QB vendor default —</option>
            {accounts.filter(a => ['Expense', 'Cost of Goods Sold', 'OtherCurrentLiability'].includes(a.account_type ?? '')).map(a => (
              <option key={a.qb_account_id} value={a.qb_account_id}>{a.name}</option>
            ))}
          </select>
          {!vendor.qb_default_gl_account_id && !form.billflow_gl_account_id && (
            <p style={{ fontSize: 11, color: '#D97706', marginTop: 4, display: 'flex', alignItems: 'center', gap: 3 }}>
              <i className="ti ti-alert-triangle" style={{ fontSize: 11 }} />
              No GL account will be applied — set one above or add a default to this vendor in QuickBooks and re-sync.
            </p>
          )}
        </Field>

        {classTrackingEnabled && (
          <Field
            label="Default class"
            helper="When set, all line items from this vendor default to this QuickBooks class. Only visible when class tracking is enabled in Settings."
            footer={pushPrompts.class && (
              <PushPrompt
                prompt={pushPrompts.class}
                onApply={mode => handleApplyPush('class', mode)}
                onSkip={() => dismissPush('class')}
              />
            )}
          >
            <select value={form.billflow_class_id} onChange={e => set('billflow_class_id', e.target.value)} style={inputStyle}>
              <option value="">— No default class —</option>
              {classes.map(c => (
                <option key={c.qb_class_id} value={c.qb_class_id}>{c.name}</option>
              ))}
            </select>
          </Field>
        )}

        <Field
          label="Payment terms"
          helper={vendor.qb_payment_terms
            ? `QB vendor default: ${vendor.qb_payment_terms}. Select terms below to override, or leave blank to use the QB default. Used to calculate due dates when not printed on the invoice.`
            : qbTerms.length > 0
              ? 'No default terms set on this vendor in QuickBooks. Select terms to enable automatic due date calculation.'
              : 'No payment terms synced from QuickBooks yet. Run Sync Now in Settings to load your terms list.'}
        >
          <select value={form.billflow_payment_terms} onChange={e => set('billflow_payment_terms', e.target.value)} style={inputStyle}>
            <option value="">
              {vendor.qb_payment_terms ? `— Use QB default (${vendor.qb_payment_terms}) —` : '— No default terms —'}
            </option>
            {qbTerms.filter(t => t.type === 'STANDARD' && t.due_days !== null).map(t => (
              <option key={t.qb_term_id} value={t.name}>{t.name}{t.due_days != null ? ` (${t.due_days} days)` : ''}</option>
            ))}
            {qbTerms.filter(t => t.type !== 'STANDARD').map(t => (
              <option key={t.qb_term_id} value={t.name}>{t.name}</option>
            ))}
          </select>
        </Field>

        <Field
          label="Default memo / description"
          helper="Pre-populates the QB bill memo field for all invoices from this vendor. Useful for adding job cost codes or notes automatically."
          footer={pushPrompts.description && (
            <PushPrompt
              prompt={pushPrompts.description}
              onApply={mode => handleApplyPush('description', mode)}
              onSkip={() => dismissPush('description')}
            />
          )}
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
        <Field
          label="Default due date"
          helper="Overrides the company default. Applied when no due date is found on the invoice. 'Same as invoice date' sets due date equal to the invoice date. 'Calculate from payment terms' adds the vendor's payment term days."
        >
          <select value={form.default_due_date} onChange={e => set('default_due_date', e.target.value)} style={inputStyle}>
            <option value="not_set">Use company default</option>
            <option value="not_required">Not required — leave blank if not on invoice</option>
            <option value="same_as_invoice_date">Same as invoice date</option>
            <option value="from_payment_terms">Calculate from payment terms</option>
          </select>
        </Field>
        <ToggleField
          label="Auto-publish bills"
          helper="When on, invoices from this vendor are automatically pushed to QuickBooks without review — as long as all eligibility checks pass. Purchasomatic will suggest enabling this after 5 accurate invoices."
          checked={form.auto_publish_enabled}
          onChange={v => set('auto_publish_enabled', v)}
        />
        <ToggleField
          label="Auto-publish POs"
          helper="When on, purchase order confirmations from this vendor are automatically pushed to QuickBooks without review. Requires PO push to be enabled in company settings."
          checked={form.auto_publish_po_enabled}
          onChange={v => set('auto_publish_po_enabled', v)}
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
              footer={pushPrompts.payment_account && (
                <PushPrompt
                  prompt={pushPrompts.payment_account}
                  onApply={mode => handleApplyPush('payment_account', mode)}
                  onSkip={() => dismissPush('payment_account')}
                />
              )}
            >
              <select value={form.default_payment_account_id} onChange={e => set('default_payment_account_id', e.target.value)} style={inputStyle}>
                <option value="">— Select payment account —</option>
                {accounts.filter(a => ['Bank', 'CreditCard'].includes(a.account_type ?? '') && a.account_type != null).map(a => (
                  <option key={a.qb_account_id} value={a.qb_account_id}>{a.name}</option>
                ))}
              </select>
            </Field>
            <Field
              label="Default payment method"
              helper="Used to set the payment type on the QB bill payment record."
              footer={pushPrompts.payment_method && (
                <PushPrompt
                  prompt={pushPrompts.payment_method}
                  onApply={mode => handleApplyPush('payment_method', mode)}
                  onSkip={() => dismissPush('payment_method')}
                />
              )}
            >
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
          helper="When off, this vendor is hidden from all vendor dropdowns throughout Purchasomatic without being deleted. Bills already assigned to this vendor are unaffected."
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

function Field({ label, helper, children, footer }: { label: string; helper: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>{label}</label>
      {children}
      <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 3, lineHeight: 1.5 }}>{helper}</p>
      {footer}
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

function PushPrompt({
  prompt,
  onApply,
  onSkip,
}: {
  prompt: PushPromptState
  onApply: (mode: 'blank_only' | 'all_unpublished') => void
  onSkip: () => void
}) {
  if (prompt.state === 'done') {
    return <p style={{ fontSize: 11, color: '#065F46', marginTop: 5 }}>{prompt.result}</p>
  }
  const applying = prompt.state === 'applying'
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
      background: '#FFFBEB', border: '0.5px solid #FDE68A', borderRadius: 5,
      padding: '5px 8px', marginTop: 6,
    }}>
      <span style={{ fontSize: 11, color: '#92400E' }}>
        {applying ? 'Applying…' : 'Apply to existing unpublished bills?'}
      </span>
      {!applying && (
        <>
          <button
            onClick={() => onApply('blank_only')}
            title="Fill only bills where this field is currently blank"
            style={{ fontSize: 11, fontWeight: 500, color: '#92400E', background: 'white', border: '0.5px solid #FCD34D', borderRadius: 4, padding: '2px 8px', cursor: 'pointer' }}
          >
            Blank fields only
          </button>
          <button
            onClick={() => onApply('all_unpublished')}
            title="Overwrite all unpublished bills — GL account rules still take priority over vendor default"
            style={{ fontSize: 11, fontWeight: 500, color: 'white', background: '#D97706', border: 'none', borderRadius: 4, padding: '2px 8px', cursor: 'pointer' }}
          >
            All unpublished
          </button>
          <button
            onClick={onSkip}
            style={{ fontSize: 11, color: '#B45309', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0' }}
          >
            Skip
          </button>
        </>
      )}
    </div>
  )
}
