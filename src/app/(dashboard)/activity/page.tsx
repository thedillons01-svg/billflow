import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { processAnyway } from '@/app/(dashboard)/bills/actions'

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab = 'credits' } = await searchParams
  const supabase = await createClient()

  const tabs = [
    { id: 'credits',   label: 'Credits' },
    { id: 'processed', label: 'Processing Log' },
    { id: 'uploaded',  label: 'Uploaded Files' },
  ]

  // ── Credits tab ────────────────────────────────────────────────────────────
  let creditEntries: {
    id: string
    created_at: string
    amount: number
    description: string
    bill_id: string | null
    invoice_number: string | null
    vendor_name: string | null
    stripe_payment_id: string | null
  }[] = []
  let creditBalance = 0

  if (tab === 'credits') {
    const { data: company } = await supabase
      .from('companies')
      .select('credit_balance')
      .single()
    creditBalance = company?.credit_balance ?? 0

    const { data: ledger } = await supabase
      .from('credit_ledger')
      .select(`
        id, created_at, amount, description, bill_id, stripe_payment_id,
        bills!credit_ledger_bill_id_fkey(invoice_number, vendor_name_raw, vendors!bills_vendor_id_fkey(vendor_name_display))
      `)
      .order('created_at', { ascending: false })
      .limit(500)

    creditEntries = (ledger ?? []).map((row: Record<string, unknown>) => {
      const bill = row.bills as { invoice_number: string | null; vendor_name_raw: string | null; vendors: { vendor_name_display: string | null } | null } | null
      return {
        id:                row.id as string,
        created_at:        row.created_at as string,
        amount:            row.amount as number,
        description:       row.description as string,
        bill_id:           row.bill_id as string | null,
        stripe_payment_id: row.stripe_payment_id as string | null,
        invoice_number:    bill?.invoice_number ?? null,
        vendor_name:       bill?.vendors?.vendor_name_display ?? bill?.vendor_name_raw ?? null,
      }
    })
  }

  // ── Processed items tab ────────────────────────────────────────────────────
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

  if (tab === 'processed') {
    const { data } = await supabase
      .from('processing_log')
      .select('id, action, actor, credits_used, timestamp, bill_id, document_type, before_state, after_state')
      .order('timestamp', { ascending: false })
      .limit(100)
    processedItems = (data ?? []) as typeof processedItems
  }

  // ── Uploaded files tab ─────────────────────────────────────────────────────
  let uploadedFiles: {
    id: string
    type: string
    vendor: string
    number: string
    created_at: string
    capture_source: string
    is_fingerprint_duplicate: boolean
  }[] = []

  if (tab === 'uploaded') {
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

  // Running balance for credits tab — computed newest-first, so reverse to walk oldest-first
  const balanceByEntry: Record<string, number> = {}
  if (tab === 'credits') {
    let running = creditBalance
    for (const entry of creditEntries) {
      balanceByEntry[entry.id] = running
      running -= entry.amount  // walk backwards: subtract this entry to get pre-entry balance
    }
  }

  const totalUsed = creditEntries.filter(e => e.amount < 0).reduce((s, e) => s + Math.abs(e.amount), 0)
  const totalAdded = creditEntries.filter(e => e.amount > 0).reduce((s, e) => s + e.amount, 0)

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
            Complete audit trail of all document processing and credit usage
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

        {/* ── Credits tab ─────────────────────────────────────────────────── */}
        {tab === 'credits' && (
          creditEntries.length === 0 ? (
            <EmptyState message="No credit activity yet. Credits are used when invoices are processed." />
          ) : (
            <>
              {/* Summary strip */}
              <div
                className="flex items-center gap-8 px-5 py-3"
                style={{ background: '#F8FBF9', borderBottom: '0.5px solid var(--color-border-tertiary)' }}
              >
                <div>
                  <p style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-secondary)' }}>Current Balance</p>
                  <p style={{ fontSize: 20, fontWeight: 600, color: '#1A3D2B', marginTop: 1 }}>{creditBalance}</p>
                </div>
                <div style={{ width: 1, height: 32, background: 'var(--color-border-tertiary)' }} />
                <div>
                  <p style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-secondary)' }}>Total Added</p>
                  <p style={{ fontSize: 20, fontWeight: 600, color: '#1A3D2B', marginTop: 1 }}>+{totalAdded}</p>
                </div>
                <div style={{ width: 1, height: 32, background: 'var(--color-border-tertiary)' }} />
                <div>
                  <p style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-secondary)' }}>Total Used</p>
                  <p style={{ fontSize: 20, fontWeight: 600, color: '#1A3D2B', marginTop: 1 }}>{totalUsed}</p>
                </div>
              </div>

              {/* Column headers */}
              <div
                className="grid px-5 py-2"
                style={{
                  gridTemplateColumns: '1.4fr 1fr 0.7fr 0.55fr 0.55fr',
                  borderBottom: '0.5px solid var(--color-border-tertiary)',
                }}
              >
                {['Invoice', 'Vendor', 'Date', 'Credits', 'Balance'].map(h => (
                  <span key={h} style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-secondary)' }}>
                    {h}
                  </span>
                ))}
              </div>

              {creditEntries.map((entry, i) => {
                const isCharge = entry.amount < 0
                const isTopUp  = entry.amount > 0
                const balance  = balanceByEntry[entry.id] ?? creditBalance
                return (
                  <div
                    key={entry.id}
                    className="grid items-center px-5 py-[10px]"
                    style={{
                      gridTemplateColumns: '1.4fr 1fr 0.7fr 0.55fr 0.55fr',
                      borderBottom: '0.5px solid var(--color-border-tertiary)',
                      background: i % 2 === 0 ? 'white' : 'var(--color-background-secondary)',
                    }}
                  >
                    {/* Invoice / description */}
                    <div>
                      {entry.bill_id ? (
                        <Link href={`/bills/${entry.bill_id}`} style={{ textDecoration: 'none' }}>
                          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>
                            {entry.invoice_number ?? 'View bill →'}
                          </span>
                        </Link>
                      ) : (
                        <span style={{ fontSize: 13, fontWeight: 500, color: isTopUp ? '#065F46' : 'var(--color-text-primary)' }}>
                          {entry.description}
                        </span>
                      )}
                    </div>

                    {/* Vendor */}
                    <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                      {entry.vendor_name ?? (isTopUp ? '—' : entry.description.replace(/^Bill processed:\s*/i, '').split(' ')[0])}
                    </span>

                    {/* Date */}
                    <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
                      {new Date(entry.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>

                    {/* Amount */}
                    <span style={{
                      fontSize: 12, fontWeight: 500, fontVariantNumeric: 'tabular-nums',
                      color: isTopUp ? '#065F46' : isCharge ? '#374151' : 'var(--color-text-secondary)',
                    }}>
                      {isTopUp ? `+${entry.amount}` : isCharge ? `−${Math.abs(entry.amount)}` : '0'}
                    </span>

                    {/* Running balance */}
                    <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                      {balance}
                    </span>
                  </div>
                )
              })}
            </>
          )
        )}

        {/* ── Processing log tab ──────────────────────────────────────────── */}
        {tab === 'processed' && (
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
        )}

        {/* ── Uploaded files tab ──────────────────────────────────────────── */}
        {tab === 'uploaded' && (
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
    bill_created:        'Bill Created',
    bill_published:      'Published to QB',
    bill_auto_published: 'Auto-Published',
    bill_deleted:        'Deleted',
    ocr_processed:       'OCR Processed',
    ocr_complete:        'OCR Complete',
    ocr_tier1:           'OCR Tier 1',
    ocr_tier2:           'OCR Tier 2',
    ocr_tier3:           'OCR Tier 3',
    po_created:          'PO Created',
    po_pushed:           'PO Pushed to QB',
  }
  return map[action] ?? action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}
