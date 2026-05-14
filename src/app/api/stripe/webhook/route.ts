import { NextRequest, NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe/client'
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

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as import('stripe').Stripe.Checkout.Session
    const companyId = session.metadata?.company_id
    const credits = Number(session.metadata?.credits ?? 0)

    if (!companyId || !credits) {
      console.error('[stripe-webhook] Missing metadata on session', session.id)
      return NextResponse.json({ error: 'Missing metadata' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // Increment credit balance
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

    // Record in ledger
    await supabase.from('credit_ledger').insert({
      company_id:  companyId,
      amount:      credits,
      description: `Purchased ${credits.toLocaleString()} credits via Stripe (session ${session.id})`,
    })

    console.log(`[stripe-webhook] Credited ${credits} to company ${companyId} — new balance ${newBalance}`)
  }

  return NextResponse.json({ received: true })
}
