import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

const CREDIT_PACKAGES = [
  { credits: 100, price: 12, label: '100 credits', note: '$0.12 / credit', popular: false },
  { credits: 500, price: 49, label: '500 credits', note: '$0.098 / credit — save 18%', popular: true },
  { credits: 1000, price: 89, label: '1,000 credits', note: '$0.089 / credit — save 26%', popular: false },
  { credits: 2500, price: 199, label: '2,500 credits', note: '$0.080 / credit — save 33%', popular: false },
]

export default async function BillingPage() {
  const supabase = await createClient()

  const { data: company } = await supabase
    .from('companies')
    .select('credit_balance, plan_name, stripe_customer_id')
    .single()

  const { data: ledger } = await supabase
    .from('credit_ledger')
    .select('amount, description, created_at, bill_id')
    .order('created_at', { ascending: false })
    .limit(50)

  const creditBalance = company?.credit_balance ?? 0

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div
        className="flex-none flex items-center justify-between px-5 py-[14px]"
        style={{ background: 'white', borderBottom: '0.5px solid var(--color-border-tertiary)' }}
      >
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 500, color: 'var(--color-text-primary)' }}>Billing & Credits</h1>
          <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>
            Purchase credits and review usage
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-5 py-5">
        <div style={{ maxWidth: 700 }} className="space-y-5">

          {/* Current balance */}
          <div
            style={{
              background: 'white',
              border: '0.5px solid var(--color-border-tertiary)',
              borderRadius: 8,
              padding: '20px 24px',
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500 }}>
                  Credit Balance
                </p>
                <p style={{ fontSize: 36, fontWeight: 700, color: 'var(--color-text-primary)', marginTop: 4, lineHeight: 1 }}>
                  {creditBalance.toLocaleString()}
                </p>
                <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 6 }}>
                  2 credits per bill · 1 credit per PO · No charge for duplicates or wrong document type
                </p>
              </div>
              <div
                style={{
                  width: 64, height: 64, borderRadius: 16,
                  background: '#EBF5EF',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <i className="ti ti-coins" style={{ fontSize: 32, color: '#1A3D2B' }} />
              </div>
            </div>
            {creditBalance < 20 && (
              <div
                className="flex items-center gap-2 mt-4 px-3 py-2"
                style={{ background: '#FEF2F2', borderRadius: 6 }}
              >
                <i className="ti ti-alert-circle" style={{ fontSize: 14, color: '#DC2626' }} />
                <p style={{ fontSize: 12, color: '#991B1B' }}>
                  Running low — purchase credits now to avoid processing delays.
                </p>
              </div>
            )}
          </div>

          {/* Credit packages */}
          <div
            style={{
              background: 'white',
              border: '0.5px solid var(--color-border-tertiary)',
              borderRadius: 8,
              overflow: 'hidden',
            }}
          >
            <div
              className="px-5 py-4"
              style={{ borderBottom: '0.5px solid var(--color-border-tertiary)' }}
            >
              <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)' }}>Purchase Credits</p>
              <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>
                Credits never expire. Secure checkout via Stripe.
              </p>
            </div>

            <div className="px-5 py-4 space-y-3">
              {CREDIT_PACKAGES.map(pkg => (
                <div
                  key={pkg.credits}
                  className="flex items-center justify-between px-4 py-3"
                  style={{
                    border: pkg.popular
                      ? '1.5px solid #2DB87A'
                      : '0.5px solid var(--color-border-tertiary)',
                    borderRadius: 8,
                    background: pkg.popular ? '#EBF5EF' : 'white',
                    position: 'relative',
                  }}
                >
                  {pkg.popular && (
                    <span
                      style={{
                        position: 'absolute', top: -10, left: 16,
                        background: '#2DB87A', color: 'white',
                        fontSize: 9, fontWeight: 600, letterSpacing: '0.04em',
                        padding: '2px 8px', borderRadius: 10,
                        textTransform: 'uppercase',
                      }}
                    >
                      Most popular
                    </span>
                  )}
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)' }}>
                      {pkg.label}
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 1 }}>
                      {pkg.note}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text-primary)' }}>
                      ${pkg.price}
                    </p>
                    <button
                      type="button"
                      disabled
                      style={{
                        background: '#2DB87A', color: 'white',
                        borderRadius: 6, padding: '7px 18px',
                        fontSize: 13, fontWeight: 500,
                        border: 'none', cursor: 'not-allowed',
                        opacity: 0.7,
                      }}
                    >
                      Buy
                    </button>
                  </div>
                </div>
              ))}

              <p style={{ fontSize: 11, color: 'var(--color-text-tertiary)', textAlign: 'center', paddingTop: 4 }}>
                Stripe billing coming soon. Contact{' '}
                <a href="mailto:support@billflow.app" style={{ color: '#2DB87A' }}>support@billflow.app</a>
                {' '}to purchase credits manually.
              </p>
            </div>
          </div>

          {/* Usage history */}
          <div
            style={{
              background: 'white',
              border: '0.5px solid var(--color-border-tertiary)',
              borderRadius: 8,
              overflow: 'hidden',
            }}
          >
            <div
              className="px-5 py-4"
              style={{ borderBottom: '0.5px solid var(--color-border-tertiary)' }}
            >
              <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)' }}>Credit History</p>
            </div>

            {!ledger || ledger.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <i className="ti ti-receipt" style={{ fontSize: 36, color: 'var(--color-text-tertiary)' }} />
                <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 10 }}>
                  No credit transactions yet
                </p>
              </div>
            ) : (
              <>
                {/* Column headers */}
                <div
                  className="grid px-5 py-2"
                  style={{
                    gridTemplateColumns: '1fr 1fr 80px',
                    borderBottom: '0.5px solid var(--color-border-tertiary)',
                  }}
                >
                  {['Date', 'Description', 'Credits'].map(h => (
                    <span key={h} style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-secondary)' }}>
                      {h}
                    </span>
                  ))}
                </div>

                {ledger.map((entry, i) => (
                  <div
                    key={i}
                    className="grid items-center px-5 py-[10px]"
                    style={{
                      gridTemplateColumns: '1fr 1fr 80px',
                      borderBottom: i < ledger.length - 1 ? '0.5px solid var(--color-border-tertiary)' : 'none',
                      background: i % 2 === 0 ? 'white' : 'var(--color-background-secondary)',
                    }}
                  >
                    <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                      {new Date(entry.created_at).toLocaleDateString()}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--color-text-primary)' }}>
                      {entry.description ?? '—'}
                    </span>
                    <span
                      style={{
                        fontSize: 12, fontWeight: 500,
                        color: entry.amount > 0 ? '#065F46' : '#991B1B',
                      }}
                    >
                      {entry.amount > 0 ? '+' : ''}{entry.amount}
                    </span>
                  </div>
                ))}
              </>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
