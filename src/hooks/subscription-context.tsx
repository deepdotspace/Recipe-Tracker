/**
 * Anonymous-safe subscription access.
 *
 * The SDK's useSubscription() always fetches /api/auth/token +
 * /_deepspace/subscriptions/me on mount, which 401s for signed-out visitors
 * and litters the console. SubscriptionBoundary mounts the real hook only
 * when a session exists; useSubscriptionSafe() falls back to a static
 * free-tier shape for anonymous users (who can't reach any paid action
 * anyway — every gate sits behind sign-in).
 *
 * Mounted once in _app.tsx. Components use useSubscriptionSafe() instead of
 * useSubscription().
 */

import { createContext, useContext, type ReactNode } from 'react'
import { useAuth, useSubscription, type SubscribeOpts } from 'deepspace'

export interface SafeSubscription {
  tier: string | null
  entitled: boolean
  isLoading: boolean
  subscribe: (slug: string, opts?: SubscribeOpts) => Promise<unknown>
  openPortal: (returnUrl?: string) => Promise<unknown>
}

const ANONYMOUS_SUBSCRIPTION: SafeSubscription = {
  tier: 'free',
  entitled: true, // the free tier is always entitled
  isLoading: false,
  subscribe: async () => {
    throw new Error('Sign in to subscribe')
  },
  openPortal: async () => {
    throw new Error('Sign in to manage billing')
  },
}

const SubscriptionContext = createContext<SafeSubscription | null>(null)

function SignedInSubscriptionProvider({ children }: { children: ReactNode }) {
  const sub = useSubscription()
  return <SubscriptionContext.Provider value={sub}>{children}</SubscriptionContext.Provider>
}

export function SubscriptionBoundary({ children }: { children: ReactNode }) {
  const { isSignedIn } = useAuth()
  if (!isSignedIn) return <>{children}</>
  return <SignedInSubscriptionProvider>{children}</SignedInSubscriptionProvider>
}

export function useSubscriptionSafe(): SafeSubscription {
  return useContext(SubscriptionContext) ?? ANONYMOUS_SUBSCRIPTION
}
