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

export type PlanKey = 50 | 100 | 200 | 500

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
    priceId:    process.env.STRIPE_PRICE_50 ?? '',
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
  200: {
    priceId:    process.env.STRIPE_PRICE_200 ?? '',
    credits:    200,
    monthlyUsd: 76,
    name:       'Professional',
    label:      '200 credits / month',
    rateNote:   '$0.38 / transaction',
    popular:    true,
  },
  500: {
    priceId:    process.env.STRIPE_PRICE_500 ?? '',
    credits:    500,
    monthlyUsd: 180,
    name:       'Business',
    label:      '500 credits / month',
    rateNote:   '$0.36 / transaction',
    popular:    false,
  },
}

// One-time top-up bundles
export const TOPUP_BUNDLES: Record<number, { credits: number; amountCents: number; label: string }> = {
  100:  { credits: 100,  amountCents: 3800,  label: '100 extra credits — $38'  },
  250:  { credits: 250,  amountCents: 9500,  label: '250 extra credits — $95'  },
  500:  { credits: 500,  amountCents: 18000, label: '500 extra credits — $180' },
}

export const TRIAL_CREDITS = 25
