import { createServiceClient } from '@/lib/supabase/service'
import { notFound } from 'next/navigation'

const STATUS_COLOR: Record<string, string> = {
  draft: '#6b7280',
  needs_review: '#f59e0b',
  ready: '#3b82f6',
  published: '#2DB87A',
  sync_error: '#ef4444',
  fingerprint_duplicate: '#d1d5db',
  rejected: '#d1d5db',
}

export default async function AdminCompanyPage({ params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params
  const supabase = createServiceClient()

  const { data: company } = await supabase
    .from('companies')
    .select('company_id, name, qb_type, credit_balance, subscription_status')
    .eq('company_id', companyId)
    .single()

  if (!company) notFound()

  const { data: bills } = await supabase
    .from('bills')
    .select(`
      bill_id, status, vendor_name_raw, invoice_number, invoice_date,
      total, ocr_tier, ocr_confidence, created_at, pdf_url,
      bill_line_items(line_id, description, quantity, unit_cost, extended_cost, is_tax_line)
    `)
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{company.name}</h1>
        <p style={{ fontSize: 13, color: '#6b7280' }}>
          QB: {company.qb_type ?? '—'} &nbsp;·&nbsp;
          Credits: {company.credit_balance ?? 0} &nbsp;·&nbsp;
          Status: {company.subscription_status ?? 'trial'}
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {(bills ?? []).map(bill => {
          const lineItems = bill.bill_line_items as {
            line_id: string; description: string | null; quantity: number | null;
            unit_cost: number | null; extended_cost: number | null; is_tax_line: boolean
          }[]
          const lineTotal = lineItems.reduce((s, l) => s + (l.extended_cost ?? 0), 0)
          const totalMatch = bill.total != null && Math.abs(lineTotal - bill.total) < 0.01

          return (
            <div key={bill.bill_id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
              {/* Bill header */}
              <div style={{ padding: '12px 16px', background: '#f9fafb', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: STATUS_COLOR[bill.status] ?? '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {bill.status.replace(/_/g, ' ')}
                </span>
                <span style={{ fontWeight: 500, fontSize: 14 }}>{bill.vendor_name_raw ?? '—'}</span>
                {bill.invoice_number && <span style={{ fontSize: 13, color: '#6b7280' }}>#{bill.invoice_number}</span>}
                {bill.invoice_date && <span style={{ fontSize: 13, color: '#6b7280' }}>{bill.invoice_date}</span>}
                <span style={{ fontSize: 13, color: bill.total != null ? '#111827' : '#9ca3af' }}>
                  {bill.total != null ? `$${Number(bill.total).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : 'no total'}
                </span>
                {bill.total != null && lineItems.length > 0 && (
                  <span style={{ fontSize: 12, color: totalMatch ? '#2DB87A' : '#ef4444' }}>
                    {totalMatch ? '✓ totals match' : `✗ lines=$${lineTotal.toFixed(2)}`}
                  </span>
                )}
                <span style={{ fontSize: 12, color: '#9ca3af', marginLeft: 'auto' }}>
                  Tier {bill.ocr_tier} · {bill.ocr_confidence ? `${Math.round(Number(bill.ocr_confidence) * 100)}% confidence` : ''}
                </span>
                {bill.pdf_url && (
                  <a
                    href={`/api/admin/pdf/${bill.bill_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: 12, color: '#2DB87A', textDecoration: 'none', border: '1px solid #2DB87A', padding: '3px 10px', borderRadius: 4, whiteSpace: 'nowrap' }}
                  >
                    View PDF ↗
                  </a>
                )}
              </div>

              {/* Line items */}
              {lineItems.length > 0 && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ color: '#9ca3af', borderBottom: '1px solid #f3f4f6' }}>
                      <th style={{ padding: '6px 16px', textAlign: 'left', fontWeight: 500 }}>Description</th>
                      <th style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 500 }}>Qty</th>
                      <th style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 500 }}>Unit</th>
                      <th style={{ padding: '6px 16px', textAlign: 'right', fontWeight: 500 }}>Extended</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map(li => (
                      <tr key={li.line_id} style={{ borderBottom: '1px solid #f9fafb', background: li.is_tax_line ? '#fffbeb' : undefined }}>
                        <td style={{ padding: '5px 16px', color: '#374151' }}>{li.description ?? '—'}{li.is_tax_line ? ' (tax)' : ''}</td>
                        <td style={{ padding: '5px 12px', textAlign: 'right', color: '#6b7280' }}>{li.quantity ?? '—'}</td>
                        <td style={{ padding: '5px 12px', textAlign: 'right', color: '#6b7280' }}>
                          {li.unit_cost != null ? `$${Number(li.unit_cost).toFixed(2)}` : '—'}
                        </td>
                        <td style={{ padding: '5px 16px', textAlign: 'right', color: '#374151' }}>
                          {li.extended_cost != null ? `$${Number(li.extended_cost).toFixed(2)}` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {lineItems.length === 0 && (
                <p style={{ padding: '10px 16px', fontSize: 12, color: '#ef4444' }}>No line items extracted</p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
