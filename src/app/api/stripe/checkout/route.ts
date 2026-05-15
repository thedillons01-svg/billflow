import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe/client'

const CREDIT_PACKAGES: Record<number, { amount: number; credits: number }> = {
  50:   { amount: 2000,  credits: 50   },
  100:  { amount: 4000,  credits: 100  },
  500:  { amount: 19000, credits: 500  },
  1000: { amount: 36000, credits: 1000 },
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { credits } = await request.json() as { credits: number }
  const pkg = CREDIT_PACKAGES[credits]
  if (!pkg) return NextResponse.json({ error: 'Invalid credit package' }, { status: 400 })

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

  // Create or reuse Stripe customer
  let customerId = company.stripe_customer_id
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: company.name,
      metadata: { company_id: company.company_id },
    })
    customerId = customer.id
    await supabase
      .from('companies')
      .update({ stripe_customer_id: customerId })
      .eq('company_id', company.company_id)
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.purchasomatic.com'

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'payment',
    line_items: [{
      quantity: 1,
      price_data: {
        currency: 'usd',
        unit_amount: pkg.amount,
        product_data: {
          name: `Purchasomatic ${pkg.credits.toLocaleString()} Credits`,
          description: `${pkg.credits.toLocaleString()} processing credits for Purchasomatic. Credits never expire.`,
        },
      },
    }],
    metadata: {
      company_id: company.company_id,
      credits: String(pkg.credits),
    },
    success_url: `${appUrl}/billing?purchased=${pkg.credits}`,
    cancel_url: `${appUrl}/billing`,
  })

  return NextResponse.json({ url: session.url })
}
