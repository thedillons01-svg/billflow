import Stripe from 'stripe'

let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY
    if (!key) throw new Error('STRIPE_SECRET_KEY not configured')
    _stripe = new Stripe(key, { apiVersion: '2026-04-22.dahlia' })
  }
  return _stripe
}

export type PlanKey = 50 | 100 | 500 | 1000

export const SUBSCRIPTION_PLANS: Record<PlanKey, {
  priceId: string
  credits: number
  monthlyUsd: number
  name: string
  label: string
  rateNote: string
  popular: boolean
}> = {
  50: {
    priceId:    process.env.STRIPE_PRICE_50  ?? '',
    credits:    50,
    monthlyUsd: 20,
    name:       'Starter',
    label:      '50 credits / month',
    rateNote:   '$0.40 / transaction',
    popular:    false,
  },
  100: {
    priceId:    process.env.STRIPE_PRICE_100 ?? '',
    credits:    100,
    monthlyUsd: 40,
    name:       'Basic',
    label:      '100 credits / month',
    rateNote:   '$0.40 / transaction',
    popular:    false,
  },
  500: {
    priceId:    process.env.STRIPE_PRICE_500 ?? '',
    credits:    500,
    monthlyUsd: 190,
    name:       'Professional',
    label:      '500 credits / month',
    rateNote:   '$0.38 / transaction — save 5%',
    popular:    true,
  },
  1000: {
    priceId:    process.env.STRIPE_PRICE_1000 ?? '',
    credits:    1000,
    monthlyUsd: 360,
    name:       'Business',
    label:      '1,000 credits / month',
    rateNote:   '$0.36 / transaction — save 10%',
    popular:    false,
  },
}

// One-time top-up bundles — same credit amounts, $0.40 flat rate
export const TOPUP_BUNDLES: Record<number, { credits: number; amountCents: number; label: string }> = {
  50:   { credits: 50,   amountCents: 2000,  label: '50 extra credits — $20'   },
  100:  { credits: 100,  amountCents: 4000,  label: '100 extra credits — $40'  },
  250:  { credits: 250,  amountCents: 10000, label: '250 extra credits — $100' },
}

export const TRIAL_CREDITS = 25
