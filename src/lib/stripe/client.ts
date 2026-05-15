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

export const CREDIT_PRICES: Record<number, { priceId: string; credits: number; label: string }> = {
  50:   { priceId: 'price_1TX5sZCFglvAqi9ImomNSBcJ', credits: 50,   label: '50 credits — $20' },
  100:  { priceId: 'price_1TX5uiCFglvAqi9IhZkU5vdm', credits: 100,  label: '100 credits — $40' },
  500:  { priceId: 'price_1TX5wZCFglvAqi9IkfXKrNXg', credits: 500,  label: '500 credits — $190' },
  1000: { priceId: 'price_1TX5xhCFglvAqi9IuZGa2Wwv', credits: 1000, label: '1,000 credits — $360' },
}
