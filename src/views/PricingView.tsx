/**
 * Pricing Page — plan cards with a monthly/yearly toggle.
 *
 * Display copy comes from the local manifest (subscriptions.ts +
 * plan-limits.ts) so the page renders even before plans are synced to
 * Stripe; checkout itself goes through useSubscription().subscribe.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from 'deepspace'
import { Check } from 'lucide-react'
import { useToast } from '../components/ui'
import { useAuthGate } from '../hooks/useAuthGate'
import { useSubscriptionSafe } from '../hooks/subscription-context'
import { subscriptionPlans, type SubscriptionPlanSlug } from '../subscriptions'
import { PLAN_DISPLAY, effectiveTier } from '../plan-limits'

type Interval = 'month' | 'year'

function formatPrice(cents: number): string {
  return cents % 100 === 0 ? `$${cents / 100}` : `$${(cents / 100).toFixed(2)}`
}

export default function PricingPage() {
  const sub = useSubscriptionSafe()
  const { isSignedIn } = useAuth()
  const { guard, authModal } = useAuthGate()
  const { error: toastError } = useToast()
  const navigate = useNavigate()
  const [interval, setInterval] = useState<Interval>('month')
  const [busySlug, setBusySlug] = useState<string | null>(null)

  const activeTier = effectiveTier(sub)
  const isPaidSubscriber = activeTier !== 'free'

  const choosePlan = (slug: SubscriptionPlanSlug) => {
    if (slug === 'free') {
      navigate('/add')
      return
    }
    guard(async () => {
      setBusySlug(slug)
      try {
        // Redirects to Stripe Checkout on success.
        await sub.subscribe(slug, { interval })
      } catch (e) {
        toastError(
          'Could not start checkout',
          e instanceof Error ? e.message : 'Plans may not be synced yet — try again after the next deploy.',
        )
        setBusySlug(null)
      }
    })
  }

  return (
    <div className="min-h-full">
      <div className="mx-auto max-w-[1000px] px-7 py-10">
        {/* Header */}
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-[12px] font-bold uppercase tracking-[0.14em] text-primary-deep">
            Plans &amp; Pricing
          </span>
          <h1 className="mt-2 text-[36px] font-extrabold tracking-[-0.03em] text-ink max-sm:text-3xl">
            Plans for every kitchen
          </h1>
          <p className="mt-2 text-[14.5px] text-muted-foreground">
            Every extraction runs real scraping and AI — plans keep that sustainable.
            Start free, upgrade when your recipe box fills up.
          </p>

          {/* Interval toggle */}
          <div className="mt-6 inline-flex items-center gap-1 rounded-full bg-cream p-1">
            {(['month', 'year'] as Interval[]).map((i) => (
              <button
                key={i}
                onClick={() => setInterval(i)}
                className={`rounded-full px-4 py-1.5 text-[13.5px] font-semibold transition-colors duration-150 ${
                  interval === i
                    ? 'bg-card text-primary shadow-[0_2px_6px_rgba(61,35,20,0.12)]'
                    : 'text-[#8a6a4a] hover:text-ink'
                }`}
              >
                {i === 'month' ? 'Monthly' : 'Yearly'}
              </button>
            ))}
            <span className="px-2 text-xs font-semibold text-success">2 months free yearly</span>
          </div>
        </div>

        {/* Plan cards */}
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {subscriptionPlans.map((plan) => {
            const display = PLAN_DISPLAY[plan.slug]
            const isCurrent = activeTier === plan.slug && (plan.slug === 'free' ? !isPaidSubscriber : true)
            const monthly = plan.priceCents
            const yearly = 'yearlyCents' in plan ? plan.yearlyCents : undefined
            const shownPrice =
              plan.slug === 'free'
                ? 'Free'
                : interval === 'year' && yearly
                  ? `${formatPrice(yearly)}`
                  : `${formatPrice(monthly)}`
            const perLabel = plan.slug === 'free' ? '' : interval === 'year' ? '/year' : '/month'
            const trialDays = 'trialDays' in plan ? plan.trialDays : undefined

            return (
              <div
                key={plan.slug}
                className={`relative flex flex-col rounded-[20px] border bg-card p-6 shadow-[0_12px_26px_-18px_rgba(61,35,20,0.4)] transition-transform duration-150 ease-out hover:-translate-y-1 hover:shadow-[0_22px_44px_-24px_rgba(61,35,20,0.55)] ${
                  display.highlight ? 'border-primary' : 'border-border'
                }`}
              >
                {display.highlight && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-cream px-3 py-0.5 text-xs font-bold text-primary-deep shadow-[0_2px_8px_rgba(61,35,20,0.15)]">
                    Most popular
                  </span>
                )}

                <h2 className="text-[18px] font-extrabold tracking-[-0.01em] text-ink">{plan.name}</h2>
                <p className="mt-1 min-h-10 text-[13.5px] text-body-soft">{display.tagline}</p>

                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-[32px] font-extrabold tracking-[-0.02em] text-ink">{shownPrice}</span>
                  {perLabel && <span className="text-sm text-muted-2">{perLabel}</span>}
                </div>
                {trialDays && (
                  <p className="mt-1 text-xs font-semibold text-success">{trialDays}-day free trial</p>
                )}

                <ul className="mt-5 flex-1 space-y-2.5">
                  {display.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-[13.5px] text-body-soft">
                      <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-success" />
                      {f}
                    </li>
                  ))}
                </ul>

                <div className="mt-6">
                  {isCurrent ? (
                    <span className="flex w-full items-center justify-center rounded-[12px] border border-border bg-surface-soft px-4 py-2.5 text-[13.5px] font-semibold text-body-soft">
                      Current plan
                    </span>
                  ) : (
                    <button
                      onClick={() => choosePlan(plan.slug)}
                      disabled={busySlug === plan.slug}
                      className="w-full rounded-[12px] bg-primary px-4 py-2.5 text-[13.5px] font-bold text-primary-foreground shadow-[0_10px_20px_-8px_rgba(226,87,11,0.7)] transition-colors duration-150 hover:bg-primary-deep disabled:opacity-60"
                    >
                      {busySlug === plan.slug
                        ? 'Opening checkout…'
                        : plan.slug === 'free'
                          ? 'Get started'
                          : trialDays
                            ? 'Start free trial'
                            : `Get ${plan.name}`}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Manage billing for existing subscribers */}
        {isSignedIn && isPaidSubscriber && (
          <div className="mt-8 text-center">
            <button
              onClick={() => sub.openPortal()}
              className="text-sm font-semibold text-primary-deep underline decoration-primary/40 underline-offset-4 transition-colors hover:decoration-primary"
            >
              Manage billing, change plan, or cancel
            </button>
          </div>
        )}

        <p className="mt-10 text-center text-xs text-muted-2">
          Prices in USD. Cancel anytime — your recipes stay yours on every plan.
        </p>
      </div>

      {authModal}
    </div>
  )
}
