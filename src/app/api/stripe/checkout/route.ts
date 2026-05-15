import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStripe, SUBSCRIPTION_PLANS, TOPUP_BUNDLES, type PlanKey } from '@/lib/stripe/client'

async function getOrCreateCustomer(
  stripe: ReturnType<typeof getStripe>,
  supabase: Awaited<ReturnType<typeof createClient>>,
  companyId: string,
  companyName: string,
  userEmail: string | undefined,
  existingCustomerId: string | null,
): Promise<string> {
  if (existingCustomerId) return existingCustomerId

  const customer = await stripe.customers.create({
    email: userEmail,
    name: companyName,
    metadata: { company_id: companyId },
  })

  await supabase
    .from('companies')
    .update({ stripe_customer_id: customer.id })
    .eq('company_id', companyId)

  return customer.id
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as { mode: 'subscription' | 'topup'; credits: number }
  const { mode, credits } = body

  const { data: company } = await supabase
    .from('companies')
    .select('company_id, name, stripe_customer_id')
    .single()

  if (!company) return NextResponse.json({ error: 'Company not found' }, { status: 404 })

  let stripe: ReturnType<typeof getStripe>
  try {
    stripe = getStripe()
  } catch {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 })
  }

  const customerId = await getOrCreateCustomer(
    stripe, supabase,
    company.company_id, company.name,
    user.email, company.stripe_customer_id,
  )

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.purchasomatic.com'

  if (mode === 'subscription') {
    const plan = SUBSCRIPTION_PLANS[credits as PlanKey]
    if (!plan) return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
    if (!plan.priceId) return NextResponse.json({ error: 'Plan price not configured' }, { status: 503 })

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: plan.priceId, quantity: 1 }],
      metadata: {
        company_id: company.company_id,
        plan_credits: String(plan.credits),
        mode: 'subscription',
      },
      subscription_data: {
        metadata: {
          company_id: company.company_id,
          plan_credits: String(plan.credits),
        },
      },
      success_url: `${appUrl}/billing?subscribed=${plan.credits}`,
      cancel_url: `${appUrl}/billing`,
    })

    return NextResponse.json({ url: session.url })
  }

  if (mode === 'topup') {
    const bundle = TOPUP_BUNDLES[credits]
    if (!bundle) return NextResponse.json({ error: 'Invalid top-up bundle' }, { status: 400 })

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'payment',
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: bundle.amountCents,
          product_data: {
            name: `Purchasomatic Top-Up — ${bundle.credits.toLocaleString()} Credits`,
            description: `${bundle.credits.toLocaleString()} one-time processing credits. Added instantly to your balance.`,
          },
        },
      }],
      metadata: {
        company_id: company.company_id,
        credits: String(bundle.credits),
        mode: 'topup',
      },
      success_url: `${appUrl}/billing?topup=${bundle.credits}`,
      cancel_url: `${appUrl}/billing`,
    })

    return NextResponse.json({ url: session.url })
  }

  return NextResponse.json({ error: 'Invalid mode' }, { status: 400 })
}
