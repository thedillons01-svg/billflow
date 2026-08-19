import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getStripe, creditsForPriceId } from '@/lib/stripe/client'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(request: NextRequest) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!webhookSecret || !sig) {
    return NextResponse.json({ error: 'Missing webhook config' }, { status: 400 })
  }

  let stripe: ReturnType<typeof getStripe>
  try {
    stripe = getStripe()
  } catch {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 })
  }

  let event: import('stripe').Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch (err) {
    console.error('[stripe-webhook] Signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // ── Subscription created or updated via checkout ─────────────────
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as import('stripe').Stripe.Checkout.Session

    if (session.mode === 'subscription') {
      const companyId = session.metadata?.company_id
      const planCredits = Number(session.metadata?.plan_credits ?? 0)
      const subscriptionId = typeof session.subscription === 'string'
        ? session.subscription
        : session.subscription?.id ?? null

      if (!companyId) {
        console.error('[stripe-webhook] Missing company_id on subscription checkout', session.id)
        return NextResponse.json({ error: 'Missing metadata' }, { status: 400 })
      }

      await supabase
        .from('companies')
        .update({
          subscription_status:    'active',
          plan_credits:           planCredits,
          stripe_subscription_id: subscriptionId,
        })
        .eq('company_id', companyId)

      await addCredits(supabase, companyId, planCredits,
        `Subscription activated: ${planCredits.toLocaleString()} credits added`)

      console.log(`[stripe-webhook] Subscription activated — company ${companyId}, ${planCredits} credits/month`)
    }

    if (session.mode === 'payment') {
      // One-time top-up
      const companyId = session.metadata?.company_id
      const credits = Number(session.metadata?.credits ?? 0)

      if (!companyId || !credits) {
        console.error('[stripe-webhook] Missing metadata on topup session', session.id)
        return NextResponse.json({ error: 'Missing metadata' }, { status: 400 })
      }

      await addCredits(supabase, companyId, credits,
        `Top-up: ${credits.toLocaleString()} credits purchased (session ${session.id})`)
    }
  }

  // ── Monthly subscription renewal ─────────────────────────────────
  if (event.type === 'invoice.paid') {
    const invoice = event.data.object as Stripe.Invoice

    // Only handle subscription renewals (not the initial checkout invoice,
    // which is credited via checkout.session.completed above)
    const subRef = invoice.parent?.subscription_details?.subscription
    const subscriptionId: string | null =
      typeof subRef === 'string' ? subRef
      : (subRef?.id ?? null)

    const billingReason: string | null = invoice.billing_reason ?? null

    if (!subscriptionId || billingReason === 'subscription_create') {
      return NextResponse.json({ received: true })
    }

    // Look up the company by Stripe customer ID
    const customerId: string | null =
      typeof invoice.customer === 'string' ? invoice.customer
      : (invoice.customer?.id ?? null)

    if (!customerId) return NextResponse.json({ received: true })

    const { data: company } = await supabase
      .from('companies')
      .select('company_id, plan_credits')
      .eq('stripe_customer_id', customerId)
      .single()

    if (!company || !company.plan_credits) {
      console.warn('[stripe-webhook] invoice.paid: no company or plan_credits for customer', customerId)
      return NextResponse.json({ received: true })
    }

    await addCredits(supabase, company.company_id, company.plan_credits,
      `Monthly renewal: ${company.plan_credits.toLocaleString()} credits added`)

    console.log(`[stripe-webhook] Renewal credited — company ${company.company_id}, +${company.plan_credits}`)
  }

  // ── Subscription cancelled ────────────────────────────────────────
  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object as import('stripe').Stripe.Subscription
    const companyId = sub.metadata?.company_id

    if (companyId) {
      await supabase
        .from('companies')
        .update({ subscription_status: 'canceled', plan_credits: null, stripe_subscription_id: null })
        .eq('company_id', companyId)

      console.log(`[stripe-webhook] Subscription canceled — company ${companyId}`)
    }
  }

  // ── Subscription updated: payment failure, or plan switched via portal ──
  if (event.type === 'customer.subscription.updated') {
    const sub = event.data.object as import('stripe').Stripe.Subscription
    const companyId = sub.metadata?.company_id

    // Sync subscription_status from Stripe's actual status on every update, not just
    // the past_due transition — otherwise a recovered payment (past_due -> active)
    // never gets written back, leaving the company stuck blocked once credits run out
    // even though they're a current paying customer. Cancellation is handled by the
    // separate customer.subscription.deleted event, not here.
    const STATUS_MAP: Partial<Record<Stripe.Subscription.Status, 'active' | 'past_due'>> = {
      active:   'active',
      trialing: 'active',
      past_due: 'past_due',
      unpaid:   'past_due',
    }
    const mappedStatus = STATUS_MAP[sub.status]

    if (companyId && mappedStatus) {
      await supabase
        .from('companies')
        .update({ subscription_status: mappedStatus })
        .eq('company_id', companyId)

      console.log(`[stripe-webhook] Subscription status synced — company ${companyId}, now ${mappedStatus} (Stripe: ${sub.status})`)
    }

    // Portal plan switches use proration_behavior: 'none', so this only
    // updates what gets granted at the *next* renewal — no immediate
    // charge or credit change happens here.
    const currentPriceId = sub.items.data[0]?.price?.id ?? null
    const newPlanCredits = currentPriceId ? creditsForPriceId(currentPriceId) : null

    if (companyId && newPlanCredits) {
      await supabase
        .from('companies')
        .update({ plan_credits: newPlanCredits })
        .eq('company_id', companyId)

      console.log(`[stripe-webhook] Plan synced from portal — company ${companyId}, now ${newPlanCredits} credits/month`)
    }
  }

  return NextResponse.json({ received: true })
}

async function addCredits(
  supabase: ReturnType<typeof import('@/lib/supabase/service').createServiceClient>,
  companyId: string,
  credits: number,
  description: string,
) {
  const { data: company } = await supabase
    .from('companies')
    .select('credit_balance')
    .eq('company_id', companyId)
    .single()

  const newBalance = (company?.credit_balance ?? 0) + credits

  await supabase
    .from('companies')
    .update({ credit_balance: newBalance })
    .eq('company_id', companyId)

  await supabase.from('credit_ledger').insert({
    company_id:  companyId,
    amount:      credits,
    description,
  })
}
