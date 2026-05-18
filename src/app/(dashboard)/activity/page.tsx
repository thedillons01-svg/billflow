import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { processAnyway } from '@/app/(dashboard)/bills/actions'

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab = 'processed' } = await searchParams
  const supabase = await createClient()

  const tabs = [
    { id: 'processed', label: 'Processed Items' },
    { id: 'uploaded',  label: 'Uploaded Files' },
  ]

  // Processed items: from processing_log
  let processedItems: {
    id: string
    action: string
    actor: string
    credits_used: number
    timestamp: string
    bill_id: string | null
    document_type: string | null
    before_state: Record<string, unknown> | null
    after_state: Record<string, unknown> | null
  }[] = []

  // Uploaded files: bills and POs with capture_source
  let uploadedFiles: {
    id: string
    type: string
    vendor: string
    number: string
    created_at: string
    capture_source: string
    is_fingerprint_duplicate: boolean
  }[] = []

  if (tab === 'processed') {
    const { data } = await supabase
      .from('processing_log')
      .select('id, action, actor, credits_used, timestamp, bill_id, document_type, before_state, after_state')
      .order('timestamp', { ascending: false })
      .limit(100)
    processedItems = (data ?? []) as typeof processedItems
  } else {
    const [{ data: bills }, { data: pos }] = await Promise.all([
      supabase
        .from('bills')
        .select('bill_id, vendor_name_raw, invoice_number, created_at, capture_source, status')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('purchase_orders')
        .select('po_id, vendor_name_raw, po_number, created_at, capture_source')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(50),
    ])
    uploadedFiles = [
      ...(bills ?? []).map(b => ({
        id: b.bill_id,
        type: 'Bill',
        vendor: b.vendor_name_raw ?? '—',
        number: b.invoice_number ?? '—',
        created_at: b.created_at,
        capture_source: b.capture_source ?? 'upload',
        is_fingerprint_duplicate: b.status === 'fingerprint_duplicate',
      })),
      ...(pos ?? []).map(p => ({
        id: p.po_id,
        type: 'PO',
        vendor: p.vendor_name_raw ?? '—',
        number: p.po_number ?? '—',
        created_at: p.created_at,
        capture_source: p.capture_source ?? 'email',
        is_fingerprint_duplicate: false,
      })),
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div
        className="flex-none flex items-center justify-between px-5 py-[14px]"
        style={{ background: 'white', borderBottom: '0.5px solid var(--color-border-tertiary)' }}
      >
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 500, color: 'var(--color-text-primary)' }}>Activity Log</h1>
          <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>
            Complete audit trail of all document processing and actions
          </p>
        </div>
      </div>

      {/* Tab bar */}
      <div
        className="flex-none flex items-end px-5"
        style={{ background: 'white', borderBottom: '0.5px solid var(--color-border-tertiary)' }}
      >
        {tabs.map(t => (
          <Link
            key={t.id}
            href={`/activity?tab=${t.id}`}
            style={{
              padding: '10px 14px',
              fontSize: 12,
              fontWeight: tab === t.id ? 500 : 400,
              color: tab === t.id ? '#1A3D2B' : 'var(--color-text-secondary)',
              borderBottom: tab === t.id ? '2px solid #2DB87A' : '2px solid transparent',
              marginBottom: -1,
              textDecoration: 'none',
            }}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto" style={{ background: 'white' }}>
        {tab === 'processed' ? (
          processedItems.length === 0 ? (
            <EmptyState message="No activity recorded yet. Actions taken on bills and POs will appear here." />
          ) : (
            <>
              <div
                className="grid px-5 py-2"
                style={{
                  gridTemplateColumns: '1.2fr 1.5fr 0.7fr 0.8fr 0.6fr',
                  borderBottom: '0.5px solid var(--color-border-tertiary)',
                }}
              >
                {['Action', 'Details', 'Actor', 'Date', 'Credits'].map(h => (
                  <span key={h} style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-secondary)' }}>
                    {h}
                  </span>
                ))}
              </div>
              {processedItems.map((item, i) => (
                <div
                  key={item.id}
                  className="grid items-center px-5 py-[10px]"
                  style={{
                    gridTemplateColumns: '1.2fr 1.5fr 0.7fr 0.8fr 0.6fr',
                    borderBottom: '0.5px solid var(--color-border-tertiary)',
                    background: i % 2 === 0 ? 'white' : 'var(--color-background-secondary)',
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>
                    {formatAction(item.action)}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
                    {item.document_type ?? ''} {item.bill_id ? `· ${item.bill_id.slice(0, 8)}…` : ''}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
                    {item.actor === 'system' ? 'System' : 'User'}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
                    {new Date(item.timestamp).toLocaleString()}
                  </span>
                  <span style={{ fontSize: 11, color: item.credits_used > 0 ? '#2DB87A' : 'var(--color-text-tertiary)' }}>
                    {item.credits_used > 0 ? `-${item.credits_used}` : '—'}
                  </span>
                </div>
              ))}
            </>
          )
        ) : (
          uploadedFiles.length === 0 ? (
            <EmptyState message="No files uploaded yet. Bills and POs captured via email will appear here." />
          ) : (
            <>
              <div
                className="grid px-5 py-2"
                style={{
                  gridTemplateColumns: '0.5fr 1.5fr 1fr 0.8fr 0.8fr 1fr',
                  borderBottom: '0.5px solid var(--color-border-tertiary)',
                }}
              >
                {['Type', 'Vendor', 'Number', 'Source', 'Date', ''].map(h => (
                  <span key={h} style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-secondary)' }}>
                    {h}
                  </span>
                ))}
              </div>
              {uploadedFiles.map((f, i) => (
                <div
                  key={f.id}
                  className="grid items-center px-5 py-[10px]"
                  style={{
                    gridTemplateColumns: '0.5fr 1.5fr 1fr 0.8fr 0.8fr 1fr',
                    borderBottom: '0.5px solid var(--color-border-tertiary)',
                    background: f.is_fingerprint_duplicate ? '#FFFBEB' : i % 2 === 0 ? 'white' : 'var(--color-background-secondary)',
                  }}
                >
                  <span
                    style={{
                      display: 'inline-block',
                      background: f.type === 'Bill' ? '#DBEAFE' : '#D1FAE5',
                      color: f.type === 'Bill' ? '#1E40AF' : '#065F46',
                      borderRadius: 4, padding: '2px 6px',
                      fontSize: 10, fontWeight: 500,
                    }}
                  >
                    {f.type}
                  </span>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>
                      {f.vendor}
                    </span>
                    {f.is_fingerprint_duplicate && (
                      <p style={{ fontSize: 10, color: '#92400E', marginTop: 1 }}>
                        <i className="ti ti-alert-triangle" style={{ fontSize: 10, marginRight: 2 }} />
                        Duplicate file — same PDF already received
                      </p>
                    )}
                  </div>
                  <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                    {f.number}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <i className={`ti ${f.capture_source === 'email' ? 'ti-mail' : 'ti-upload'}`} style={{ fontSize: 12 }} />
                    {f.capture_source === 'email' ? 'Email' : 'Upload'}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
                    {new Date(f.created_at).toLocaleDateString()}
                  </span>
                  <div>
                    {f.is_fingerprint_duplicate && f.type === 'Bill' && (
                      <form action={processAnyway.bind(null, f.id)}>
                        <button
                          type="submit"
                          style={{
                            fontSize: 11, fontWeight: 500,
                            color: '#92400E', background: '#FEF3C7',
                            border: '0.5px solid #F59E0B',
                            borderRadius: 4, padding: '3px 8px',
                            cursor: 'pointer',
                          }}
                        >
                          Process Anyway
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              ))}
            </>
          )
        )}
      </div>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
      <i className="ti ti-clock" style={{ fontSize: 48, color: 'var(--color-text-tertiary)' }} />
      <h2 style={{ fontSize: 16, fontWeight: 500, color: 'var(--color-text-primary)', marginTop: 16 }}>
        No activity yet
      </h2>
      <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 6, maxWidth: 380 }}>
        {message}
      </p>
    </div>
  )
}

function formatAction(action: string) {
  const map: Record<string, string> = {
    bill_created:      'Bill Created',
    bill_published:    'Published to QB',
    bill_auto_published: 'Auto-Published',
    bill_deleted:      'Deleted',
    ocr_processed:     'OCR Processed',
    ocr_tier1:         'OCR Tier 1',
    ocr_tier2:         'OCR Tier 2',
    ocr_tier3:         'OCR Tier 3',
    po_created:        'PO Created',
    po_pushed:         'PO Pushed to QB',
  }
  return map[action] ?? action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}
