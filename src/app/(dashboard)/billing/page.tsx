import { createClient } from '@/lib/supabase/server'
import { CheckoutButton, ManageSubscriptionButton } from './checkout-button'
import { SUBSCRIPTION_PLANS, TOPUP_BUNDLES } from '@/lib/stripe/client'

const PLANS = Object.values(SUBSCRIPTION_PLANS)
const TOPUPS = Object.values(TOPUP_BUNDLES)

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ subscribed?: string; topup?: string }>
}) {
  const { subscribed, topup } = await searchParams
  const supabase = await createClient()

  const { data: company } = await supabase
    .from('companies')
    .select('credit_balance, plan_credits, subscription_status, stripe_customer_id')
    .single()

  const { data: ledger } = await supabase
    .from('credit_ledger')
    .select('amount, description, created_at')
    .order('created_at', { ascending: false })
    .limit(50)

  const creditBalance      = company?.credit_balance      ?? 0
  const planCredits        = company?.plan_credits         ?? null
  const subscriptionStatus = company?.subscription_status ?? 'trial'
  const hasSubscription    = subscriptionStatus === 'active' || subscriptionStatus === 'past_due'
  const stripeConfigured   = !!process.env.STRIPE_SECRET_KEY

  const currentPlan = planCredits
    ? PLANS.find(p => p.credits === planCredits) ?? null
    : null

  const successCredits = subscribed ? Number(subscribed) : topup ? Number(topup) : null
  const successMessage = subscribed
    ? `You're subscribed! ${Number(subscribed).toLocaleString()} credits added to your account each month.`
    : topup
    ? `${Number(topup).toLocaleString()} credits added to your account.`
    : null

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
            Manage your subscription and credit balance
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-5 py-5">
        <div style={{ maxWidth: 700 }} className="space-y-5">

          {/* Success banner */}
          {successMessage && (
            <div
              className="flex items-center gap-3 px-4 py-3"
              style={{ background: '#D1FAE5', border: '0.5px solid #6EE7B7', borderRadius: 8 }}
            >
              <i className="ti ti-circle-check" style={{ fontSize: 16, color: '#065F46' }} />
              <p style={{ fontSize: 13, fontWeight: 500, color: '#065F46' }}>{successMessage}</p>
            </div>
          )}

          {/* Past due warning */}
          {subscriptionStatus === 'past_due' && (
            <div
              className="flex items-center gap-3 px-4 py-3"
              style={{ background: '#FEF2F2', border: '0.5px solid #FECACA', borderRadius: 8 }}
            >
              <i className="ti ti-alert-circle" style={{ fontSize: 16, color: '#DC2626' }} />
              <div>
                <p style={{ fontSize: 13, fontWeight: 500, color: '#991B1B' }}>Payment failed</p>
                <p style={{ fontSize: 12, color: '#991B1B', marginTop: 2 }}>
                  Update your payment method to keep your subscription active.
                </p>
              </div>
              <div className="ml-auto">
                <ManageSubscriptionButton />
              </div>
            </div>
          )}

          {/* Credit balance + plan status */}
          <div
            style={{
              background: 'white',
              border: '0.5px solid var(--color-border-tertiary)',
              borderRadius: 8,
              padding: '20px 24px',
            }}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500 }}>
                  Credit Balance
                </p>
                <p style={{ fontSize: 36, fontWeight: 700, color: 'var(--color-text-primary)', marginTop: 4, lineHeight: 1 }}>
                  {creditBalance.toLocaleString()}
                </p>
                <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 6 }}>
                  {hasSubscription && currentPlan
                    ? `${currentPlan.credits.toLocaleString()} credits added each month · unused credits roll over`
                    : '1 credit per bill or PO · credits roll over'}
                </p>
              </div>

              <div className="flex flex-col items-end gap-3">
                <div
                  style={{
                    width: 56, height: 56, borderRadius: 14,
                    background: '#EBF5EF',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <i className="ti ti-coins" style={{ fontSize: 28, color: '#1A3D2B' }} />
                </div>

                {/* Plan badge */}
                {subscriptionStatus === 'trial' && (
                  <span
                    style={{
                      fontSize: 11, fontWeight: 600,
                      background: '#DBEAFE', color: '#1E40AF',
                      padding: '3px 10px', borderRadius: 10,
                    }}
                  >
                    Free trial
                  </span>
                )}
                {subscriptionStatus === 'active' && currentPlan && (
                  <span
                    style={{
                      fontSize: 11, fontWeight: 600,
                      background: '#D1FAE5', color: '#065F46',
                      padding: '3px 10px', borderRadius: 10,
                    }}
                  >
                    {currentPlan.name} plan
                  </span>
                )}
                {subscriptionStatus === 'canceled' && (
                  <span
                    style={{
                      fontSize: 11, fontWeight: 600,
                      background: '#F3F4F6', color: '#6B7280',
                      padding: '3px 10px', borderRadius: 10,
                    }}
                  >
                    Canceled
                  </span>
                )}
              </div>
            </div>

            {/* Trial low-credit warning */}
            {subscriptionStatus === 'trial' && creditBalance <= 5 && (
              <div
                className="flex items-center gap-2 mt-4 px-3 py-2"
                style={{ background: '#FEF2F2', borderRadius: 6 }}
              >
                <i className="ti ti-alert-circle" style={{ fontSize: 14, color: '#DC2626' }} />
                <p style={{ fontSize: 12, color: '#991B1B' }}>
                  {creditBalance === 0
                    ? 'Your free trial credits are used up. Subscribe to keep processing invoices.'
                    : `Only ${creditBalance} trial credit${creditBalance !== 1 ? 's' : ''} remaining. Subscribe below to continue after your trial.`}
                </p>
              </div>
            )}

            {/* Subscribed low-credit warning */}
            {hasSubscription && creditBalance < 10 && (
              <div
                className="flex items-center gap-2 mt-4 px-3 py-2"
                style={{ background: '#FFFBEB', borderRadius: 6 }}
              >
                <i className="ti ti-alert-triangle" style={{ fontSize: 14, color: '#D97706' }} />
                <p style={{ fontSize: 12, color: '#92400E' }}>
                  Running low mid-cycle. Purchase a top-up below or upgrade your plan.
                </p>
              </div>
            )}

            {/* Manage subscription button for active subscribers */}
            {hasSubscription && (
              <div className="flex items-center justify-between mt-4 pt-4" style={{ borderTop: '0.5px solid var(--color-border-tertiary)' }}>
                <p style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                  {currentPlan
                    ? `${currentPlan.name} plan · ${currentPlan.credits.toLocaleString()} credits/month · $${currentPlan.monthlyUsd}/month`
                    : 'Active subscription'}
                </p>
                <ManageSubscriptionButton />
              </div>
            )}
          </div>

          {/* Subscription plans — shown if on trial, canceled, or wants to upgrade */}
          {(!hasSubscription || subscriptionStatus === 'canceled') && (
            <div
              style={{
                background: 'white',
                border: '0.5px solid var(--color-border-tertiary)',
                borderRadius: 8,
                overflow: 'hidden',
              }}
            >
              <div className="px-5 py-4" style={{ borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
                <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)' }}>
                  {subscriptionStatus === 'trial' ? 'Choose a Plan' : 'Reactivate Subscription'}
                </p>
                <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>
                  Monthly subscription · credits roll over · cancel any time
                </p>
              </div>

              <div className="px-5 py-4 space-y-3">
                {PLANS.map(plan => (
                  <div
                    key={plan.credits}
                    className="flex items-center justify-between px-4 py-3"
                    style={{
                      border: plan.popular
                        ? '1.5px solid #2DB87A'
                        : '0.5px solid var(--color-border-tertiary)',
                      borderRadius: 8,
                      background: plan.popular ? '#EBF5EF' : 'white',
                      position: 'relative',
                    }}
                  >
                    {plan.popular && (
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
                        {plan.name} — {plan.credits.toLocaleString()} credits/month
                      </p>
                      <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 1 }}>
                        {plan.rateNote}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text-primary)' }}>
                          ${plan.monthlyUsd}
                        </p>
                        <p style={{ fontSize: 10, color: 'var(--color-text-secondary)' }}>/month</p>
                      </div>
                      {stripeConfigured ? (
                        <CheckoutButton
                          credits={plan.credits}
                          mode="subscription"
                          label="Subscribe"
                        />
                      ) : (
                        <button
                          type="button"
                          disabled
                          style={{
                            background: '#2DB87A', color: 'white',
                            borderRadius: 6, padding: '8px 20px',
                            fontSize: 13, fontWeight: 500,
                            border: 'none', opacity: 0.5, cursor: 'not-allowed',
                          }}
                        >
                          Subscribe
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {!stripeConfigured && (
                  <p style={{ fontSize: 11, color: 'var(--color-text-tertiary)', textAlign: 'center', paddingTop: 4 }}>
                    Billing coming soon. Contact{' '}
                    <a href="mailto:support@purchasomatic.com" style={{ color: '#2DB87A' }}>support@purchasomatic.com</a>
                    {' '}to purchase credits manually.
                  </p>
                )}
                <p style={{ fontSize: 11, color: 'var(--color-text-tertiary)', textAlign: 'center', paddingTop: 4 }}>
                  <a href="/pricing" target="_blank" rel="noreferrer" style={{ color: '#2DB87A', textDecoration: 'none' }}>
                    View full pricing details →
                  </a>
                </p>
              </div>
            </div>
          )}

          {/* Top-up credits — shown for active subscribers */}
          {hasSubscription && stripeConfigured && (
            <div
              style={{
                background: 'white',
                border: '0.5px solid var(--color-border-tertiary)',
                borderRadius: 8,
                overflow: 'hidden',
              }}
            >
              <div className="px-5 py-4" style={{ borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
                <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)' }}>Top-Up Credits</p>
                <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>
                  One-time credit purchase if you run out mid-cycle. Added instantly to your balance.
                </p>
              </div>
              <div className="px-5 py-4 space-y-3">
                {TOPUPS.map(bundle => (
                  <div
                    key={bundle.credits}
                    className="flex items-center justify-between px-4 py-3"
                    style={{ border: '0.5px solid var(--color-border-tertiary)', borderRadius: 8 }}
                  >
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)' }}>
                        {bundle.credits.toLocaleString()} credits
                      </p>
                      <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 1 }}>
                        $0.40 / credit — one-time purchase
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text-primary)' }}>
                        ${bundle.amountCents / 100}
                      </p>
                      <CheckoutButton
                        credits={bundle.credits}
                        mode="topup"
                        label="Buy"
                        style={{ padding: '7px 16px' }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upgrade plan section — for active subscribers who want more credits */}
          {hasSubscription && (
            <div
              style={{
                background: 'white',
                border: '0.5px solid var(--color-border-tertiary)',
                borderRadius: 8,
                overflow: 'hidden',
              }}
            >
              <div className="px-5 py-4" style={{ borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
                <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)' }}>Change Plan</p>
                <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>
                  Upgrade or downgrade via the Stripe billing portal.
                </p>
              </div>
              <div className="px-5 py-4">
                <div className="flex items-center justify-between">
                  <p style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                    Upgrade, downgrade, update payment method, or cancel — all managed securely through Stripe.
                  </p>
                  <div className="ml-4 flex-shrink-0">
                    <ManageSubscriptionButton />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Credit history */}
          <div
            style={{
              background: 'white',
              border: '0.5px solid var(--color-border-tertiary)',
              borderRadius: 8,
              overflow: 'hidden',
            }}
          >
            <div className="px-5 py-4" style={{ borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
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
