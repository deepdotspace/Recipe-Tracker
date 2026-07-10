/**
 * Per-plan feature limits and pricing-page copy.
 *
 * The Stripe-synced catalog (slugs, prices) lives in src/subscriptions.ts;
 * this file maps each plan slug to what it unlocks inside the app. Gates
 * always resolve the *effective* tier via effectiveTier() — a past_due or
 * canceled subscriber keeps their tier label but loses entitlement, so they
 * fall back to free limits (see payments reference: never gate on tier alone).
 */

import type { SubscriptionPlanSlug } from './subscriptions'

export interface PlanLimits {
  /** Link extractions allowed per calendar month. */
  extractionsPerMonth: number
  /** Max recipes saved in the collection; null = unlimited. */
  savedRecipes: number | null
  /** Whether YouTube transcript extraction is available (costs the most per call). */
  youtube: boolean
}

export const PLAN_LIMITS: Record<SubscriptionPlanSlug, PlanLimits> = {
  free: { extractionsPerMonth: 5, savedRecipes: 15, youtube: false },
  plus: { extractionsPerMonth: 50, savedRecipes: 150, youtube: true },
  pro: { extractionsPerMonth: 200, savedRecipes: null, youtube: true },
  chef: { extractionsPerMonth: 600, savedRecipes: null, youtube: true },
}

/** Pricing-page display copy, keyed by slug. */
export const PLAN_DISPLAY: Record<
  SubscriptionPlanSlug,
  { tagline: string; features: string[]; highlight?: boolean }
> = {
  free: {
    tagline: 'Try the full workflow, on the house.',
    features: [
      '5 link extractions / month',
      'Save up to 15 recipes',
      'Full Discover gallery',
      'Grocery lists & pantry',
      'AI nutrition estimates',
    ],
  },
  plus: {
    tagline: 'For weeknight cooks who save as they scroll.',
    features: [
      '50 link extractions / month',
      'Save up to 150 recipes',
      'YouTube video extraction',
      'Everything in Free',
    ],
  },
  pro: {
    tagline: 'The whole screenshot folder, cooked.',
    highlight: true,
    features: [
      '200 link extractions / month',
      'Unlimited saved recipes',
      'YouTube video extraction',
      '7-day free trial',
      'Everything in Plus',
    ],
  },
  chef: {
    tagline: 'For meal-prep coaches and heavy savers.',
    features: [
      '600 link extractions / month',
      'Unlimited saved recipes',
      'YouTube video extraction',
      'Everything in Pro',
    ],
  },
}

/**
 * The tier whose limits apply right now. Entitlement (active/trialing) is
 * required for paid limits; everyone else gets free limits.
 */
export function effectiveTier(sub: { tier: string | null; entitled: boolean }): SubscriptionPlanSlug {
  if (sub.entitled && sub.tier && sub.tier in PLAN_LIMITS) {
    return sub.tier as SubscriptionPlanSlug
  }
  return 'free'
}

/** First day of the current calendar month as ISO string (extraction quota window). */
export function currentMonthStart(): string {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
}
