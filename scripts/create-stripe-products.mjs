/**
 * Run once to create Purchasomatic subscription products and prices in Stripe.
 *
 * Usage (from project root):
 *   node scripts/create-stripe-products.mjs
 *
 * Reads STRIPE_SECRET_KEY from .env.local automatically.
 * Prints the price IDs you need to add to .env.local and Vercel.
 */

import { readFileSync } from 'fs'
import { join } from 'path'
import Stripe from 'stripe'

// ── Parse .env.local ───────────────────────────────────────────────
function parseEnvFile(path) {
  try {
    const content = readFileSync(path, 'utf8')
    const result = {}
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const idx = trimmed.indexOf('=')
      if (idx === -1) continue
      const key = trimmed.slice(0, idx).trim()
      let val = trimmed.slice(idx + 1).trim()
      if ((val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1)
      }
      result[key] = val
    }
    return result
  } catch {
    return {}
  }
}

const env = parseEnvFile(join(process.cwd(), '.env.local'))
const secretKey = process.env.STRIPE_SECRET_KEY ?? env.STRIPE_SECRET_KEY

if (!secretKey) {
  console.error('ERROR: STRIPE_SECRET_KEY not found in .env.local or environment.')
  process.exit(1)
}

if (!secretKey.startsWith('sk_test_')) {
  console.warn('WARNING: Key does not look like a test key. Double-check before running.')
}

const stripe = new Stripe(secretKey, { apiVersion: '2026-04-22.dahlia' })

// ── Subscription plans ─────────────────────────────────────────────
const PLANS = [
  { key: '50',   credits: 50,   monthlyUsd: 20,  name: 'Starter',      nickname: 'Starter — 50 credits/mo'         },
  { key: '100',  credits: 100,  monthlyUsd: 40,  name: 'Basic',        nickname: 'Basic — 100 credits/mo'           },
  { key: '500',  credits: 500,  monthlyUsd: 190, name: 'Professional', nickname: 'Professional — 500 credits/mo'    },
  { key: '1000', credits: 1000, monthlyUsd: 360, name: 'Business',     nickname: 'Business — 1,000 credits/mo'      },
]

console.log('\nCreating Purchasomatic subscription products in Stripe...\n')

const results = {}

for (const plan of PLANS) {
  process.stdout.write(`  Creating ${plan.nickname}... `)

  const product = await stripe.products.create({
    name: `Purchasomatic ${plan.name} — ${plan.credits.toLocaleString()} Credits/Month`,
    description:
      `${plan.credits.toLocaleString()} invoice and PO processing credits per month. ` +
      `Credits roll over. 1 credit per bill or PO. No charge for duplicates or reprocessing.`,
    metadata: {
      plan_key: plan.key,
      credits_per_month: String(plan.credits),
    },
  })

  const price = await stripe.prices.create({
    product: product.id,
    currency: 'usd',
    unit_amount: plan.monthlyUsd * 100,
    recurring: { interval: 'month' },
    nickname: plan.nickname,
    metadata: {
      plan_key: plan.key,
      credits: String(plan.credits),
    },
  })

  results[plan.key] = { productId: product.id, priceId: price.id, ...plan }
  console.log(`✓  ${price.id}`)
}

// ── Output ─────────────────────────────────────────────────────────
console.log('\n' + '─'.repeat(64))
console.log('Add these to your .env.local file:')
console.log('─'.repeat(64))
for (const [key, r] of Object.entries(results)) {
  console.log(`STRIPE_PRICE_${key}=${r.priceId}`)
}

console.log('\n' + '─'.repeat(64))
console.log('Then add them to Vercel (run each, paste the price ID when prompted):')
console.log('─'.repeat(64))
for (const key of Object.keys(results)) {
  console.log(`npx vercel env add STRIPE_PRICE_${key}`)
}

console.log('\nDone. Redeploy Vercel after adding the env vars.\n')
