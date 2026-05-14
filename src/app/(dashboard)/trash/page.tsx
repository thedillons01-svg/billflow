import { createClient } from '@/lib/supabase/server'
import { restoreBill, permanentlyDeleteBill } from './actions'

export default async function TrashPage() {
  const supabase = await createClient()

  // Bills deleted in the last 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const { data: deletedBills } = await supabase
    .from('bills')
    .select('bill_id, vendor_name_raw, invoice_number, invoice_date, total, deleted_at, vendors(vendor_name_display)')
    .not('deleted_at', 'is', null)
    .gte('deleted_at', thirtyDaysAgo)
    .order('deleted_at', { ascending: false })

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div
        className="flex-none flex items-center justify-between px-5 py-[14px]"
        style={{ background: 'white', borderBottom: '0.5px solid var(--color-border-tertiary)' }}
      >
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 500, color: 'var(--color-text-primary)' }}>Trash</h1>
          <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>
            Deleted bills — restored within 30 days. No credit refunded on deletion.
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-auto" style={{ background: 'white' }}>
        {!deletedBills || deletedBills.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <i className="ti ti-trash" style={{ fontSize: 48, color: 'var(--color-text-tertiary)' }} />
            <h2 style={{ fontSize: 16, fontWeight: 500, color: 'var(--color-text-primary)', marginTop: 16 }}>
              Trash is empty
            </h2>
            <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 6 }}>
              Deleted bills are recoverable for 30 days and will appear here.
            </p>
          </div>
        ) : (
          <>
            {/* Column headers */}
            <div
              className="grid px-5 py-2"
              style={{
                gridTemplateColumns: '1.8fr 0.9fr 0.7fr 0.9fr 180px',
                borderBottom: '0.5px solid var(--color-border-tertiary)',
              }}
            >
              {['Vendor', 'Invoice #', 'Date', 'Total', 'Actions'].map(h => (
                <span key={h} style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-secondary)' }}>
                  {h}
                </span>
              ))}
            </div>

            {deletedBills.map((bill, i) => {
              const vendor = (bill.vendors as unknown as { vendor_name_display: string | null } | null)
              const vendorName = vendor?.vendor_name_display ?? bill.vendor_name_raw ?? '—'
              const daysLeft = Math.ceil((new Date(bill.deleted_at!).getTime() + 30 * 24 * 60 * 60 * 1000 - Date.now()) / (24 * 60 * 60 * 1000))

              return (
                <div
                  key={bill.bill_id}
                  className="grid items-center px-5 py-[10px]"
                  style={{
                    gridTemplateColumns: '1.8fr 0.9fr 0.7fr 0.9fr 180px',
                    borderBottom: '0.5px solid var(--color-border-tertiary)',
                    background: i % 2 === 0 ? 'white' : 'var(--color-background-secondary)',
                  }}
                >
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>
                      {vendorName}
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>
                      {daysLeft} day{daysLeft !== 1 ? 's' : ''} until permanent deletion
                    </p>
                  </div>
                  <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                    {bill.invoice_number ?? '—'}
                  </span>
                  <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                    {bill.invoice_date ? new Date(bill.invoice_date).toLocaleDateString() : '—'}
                  </span>
                  <span style={{ fontSize: 13, color: 'var(--color-text-primary)' }}>
                    {bill.total != null ? `$${Number(bill.total).toFixed(2)}` : '—'}
                  </span>
                  <div className="flex items-center gap-2">
                    <form action={restoreBill.bind(null, bill.bill_id)}>
                      <button
                        type="submit"
                        style={{
                          background: 'white', color: 'var(--color-text-primary)',
                          border: '0.5px solid var(--color-border-secondary)',
                          borderRadius: 6, padding: '5px 12px',
                          fontSize: 12, cursor: 'pointer',
                        }}
                      >
                        Restore
                      </button>
                    </form>
                    <form action={permanentlyDeleteBill.bind(null, bill.bill_id)}>
                      <button
                        type="submit"
                        style={{
                          background: 'white', color: '#991B1B',
                          border: '0.5px solid #FCA5A5',
                          borderRadius: 6, padding: '5px 12px',
                          fontSize: 12, cursor: 'pointer',
                        }}
                      >
                        Delete Forever
                      </button>
                    </form>
                  </div>
                </div>
              )
            })}
          </>
        )}
      </div>
    </div>
  )
}
