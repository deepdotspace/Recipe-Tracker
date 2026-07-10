/**
 * Subscription plan declarations.
 *
 * Edit this file then `deepspace deploy` to sync the plans to Stripe Products
 * and Prices. Keep `slug` stable — subscribers and tier checks refer to it.
 *
 * Minimum prices: $3/month, $12/year — below this Stripe's per-transaction
 * fee ($0.30 + 2.9%) eats most of the charge, so the developer would receive
 * almost nothing per payout. Free plans don't hit Stripe at all.
 *
 * Per-plan feature limits (extraction quotas, save caps) live in
 * src/plan-limits.ts — this file is only what syncs to Stripe.
 */

export const subscriptionPlans = [
  {
    slug: 'free',
    name: 'Free',
    priceCents: 0,
  },
  {
    slug: 'plus',
    name: 'Plus',
    priceCents: 399, // $3.99/month
    yearlyCents: 3900, // $39/year
    taxCode: 'txcd_10000000',
  },
  {
    slug: 'pro',
    name: 'Pro',
    priceCents: 799, // $7.99/month
    yearlyCents: 7900, // $79/year
    trialDays: 7,
    taxCode: 'txcd_10000000',
  },
  {
    slug: 'chef',
    name: 'Chef',
    priceCents: 1499, // $14.99/month
    yearlyCents: 14900, // $149/year
    taxCode: 'txcd_10000000',
  },
] as const

export type SubscriptionPlanSlug = (typeof subscriptionPlans)[number]['slug']
