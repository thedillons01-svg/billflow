import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

const CONFIDENCE_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  high:   { bg: '#D1FAE5', color: '#065F46', label: 'High' },
  medium: { bg: '#FEF3C7', color: '#92400E', label: 'Medium' },
  low:    { bg: '#FEE2E2', color: '#991B1B', label: 'Low' },
}

export default async function VendorsPage() {
  const supabase = await createClient()

  const { data: vendors } = await supabase
    .from('vendors')
    .select(`
      vendor_id, vendor_name_extracted, vendor_name_display,
      invoices_processed, confidence_display, last_invoice_date,
      auto_publish_enabled, hold_for_job_match, is_visible,
      gl_account_source, qb_default_gl_account_id, billflow_gl_account_id
    `)
    .eq('is_visible', true)
    .order('invoices_processed', { ascending: false })

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div
        className="flex-none flex items-center justify-between px-5 py-[14px]"
        style={{ background: 'white', borderBottom: '0.5px solid var(--color-border-tertiary)' }}
      >
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 500, color: 'var(--color-text-primary)' }}>Vendors</h1>
          <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>
            Manage GL accounts, auto-publish rules, and line item mappings
          </p>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-auto" style={{ background: 'white' }}>
        {!vendors || vendors.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <i className="ti ti-users" style={{ fontSize: 48, color: 'var(--color-text-tertiary)' }} />
            <h2 style={{ fontSize: 16, fontWeight: 500, color: 'var(--color-text-primary)', marginTop: 16 }}>
              No vendors yet
            </h2>
            <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 6, maxWidth: 380 }}>
              Vendors are created automatically when invoices arrive. Forward an invoice to get started.
            </p>
          </div>
        ) : (
          <>
            {/* Column headers */}
            <div
              className="grid px-5 py-2"
              style={{
                gridTemplateColumns: '2fr 0.6fr 0.8fr 0.8fr 0.8fr 0.8fr',
                borderBottom: '0.5px solid var(--color-border-tertiary)',
              }}
            >
              {['Vendor', 'Invoices', 'Confidence', 'Auto-Publish', 'Hold for Job', 'Last Invoice'].map(h => (
                <span key={h} style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-secondary)' }}>
                  {h}
                </span>
              ))}
            </div>

            {vendors.map((v, i) => {
              const confBadge = v.confidence_display ? CONFIDENCE_BADGE[v.confidence_display] : null
              const glSource = v.gl_account_source as string

              return (
                <Link
                  key={v.vendor_id}
                  href={`/vendors/${v.vendor_id}`}
                  className="grid items-center px-5 py-[10px]"
                  style={{
                    gridTemplateColumns: '2fr 0.6fr 0.8fr 0.8fr 0.8fr 0.8fr',
                    borderBottom: '0.5px solid var(--color-border-tertiary)',
                    background: i % 2 === 0 ? 'white' : 'var(--color-background-secondary)',
                    textDecoration: 'none',
                    display: 'grid',
                    cursor: 'pointer',
                  }}
                >
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>
                      {v.vendor_name_display ?? v.vendor_name_extracted}
                    </p>
                    {v.vendor_name_display && v.vendor_name_display !== v.vendor_name_extracted && (
                      <p style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
                        OCR: {v.vendor_name_extracted}
                      </p>
                    )}
                  </div>
                  <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                    {v.invoices_processed ?? 0}
                  </span>
                  {confBadge ? (
                    <span
                      style={{
                        display: 'inline-block',
                        background: confBadge.bg, color: confBadge.color,
                        borderRadius: 4, padding: '3px 8px',
                        fontSize: 10, fontWeight: 500,
                      }}
                    >
                      {confBadge.label}
                    </span>
                  ) : (
                    <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>—</span>
                  )}
                  <div className="flex items-center gap-1.5">
                    <span
                      style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: v.auto_publish_enabled ? '#2DB87A' : 'var(--color-border-secondary)',
                      }}
                    />
                    <span style={{ fontSize: 12, color: v.auto_publish_enabled ? '#065F46' : 'var(--color-text-tertiary)' }}>
                      {v.auto_publish_enabled ? 'On' : 'Off'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span
                      style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: v.hold_for_job_match ? '#2DB87A' : 'var(--color-border-secondary)',
                      }}
                    />
                    <span style={{ fontSize: 12, color: v.hold_for_job_match ? '#065F46' : 'var(--color-text-tertiary)' }}>
                      {v.hold_for_job_match ? 'On' : 'Off'}
                    </span>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
                    {v.last_invoice_date ? new Date(v.last_invoice_date).toLocaleDateString() : '—'}
                  </span>
                </Link>
              )
            })}
          </>
        )}
      </div>
    </div>
  )
}
