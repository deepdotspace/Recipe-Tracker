/**
 * App — global providers + shell.
 *
 * Generouted renders this around all routes.
 * Providers → auth gate → nav + page outlet.
 */

import { Suspense, type ReactNode } from 'react'
import { Outlet, useRouteError } from 'react-router-dom'
import { DeepSpaceAuthProvider, useAuthStatus } from 'deepspace'
import { RecordProvider, RecordScope } from 'deepspace'
import { ErrorScreen, ToastProvider } from '../components/ui'
import Navigation from '../components/Navigation'
import { APP_NAME, SCOPE_ID } from '../constants'
import { schemas } from '../schemas'

export default function App() {
  return (
    <ToastProvider>
      <DeepSpaceAuthProvider>
        <AuthBoot>
          {/* data-testid="app-root" is the canonical "app shell mounted" hook
              every test relies on. Don't rename without updating templates/tests. */}
          <div data-testid="app-root" className="relative flex h-screen flex-col overflow-hidden bg-background text-foreground">
            <KitchenBackdrop />
            <div className="relative z-10 flex h-full min-h-0 flex-col">
              <Navigation />
              <main className="flex-1 overflow-y-auto min-h-0">
                <Suspense fallback={<div className="flex items-center justify-center h-full text-muted-foreground">Loading...</div>}>
                  <Outlet />
                </Suspense>
              </main>
            </div>
          </div>
        </AuthBoot>
      </DeepSpaceAuthProvider>
    </ToastProvider>
  )
}

/**
 * Warm, organic page backdrop — soft primary blooms + a faint dot grid.
 * Lives behind every page so the layout never reads as a flat rigid sheet.
 */
function KitchenBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -left-32 -top-40 h-[34rem] w-[34rem] rounded-full bg-primary/20 blur-[120px]" />
      <div className="absolute -right-24 top-1/3 h-[28rem] w-[28rem] rounded-full bg-warning/15 blur-[120px]" />
      <div className="absolute -bottom-40 left-1/4 h-[30rem] w-[30rem] rounded-full bg-primary/10 blur-[130px]" />
      <div
        className="absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)',
          backgroundSize: '28px 28px',
          color: 'var(--color-foreground)',
        }}
      />
    </div>
  )
}

/**
 * Root error boundary. Generouted wires a `_app` `Catch` export to the root
 * route's errorElement, so any render-time crash in a page — a thrown error,
 * or a hooks-rule violation like React #310 — lands here instead of React
 * Router's raw minified screen. ErrorScreen decodes the error for the developer.
 */
export function Catch() {
  const error = useRouteError()
  return <ErrorScreen error={error} />
}

/** Waits for auth to resolve, then mounts the data layer. Distinct from the SDK's `AuthGate`. */
function AuthBoot({ children }: { children: ReactNode }) {
  const { isLoaded } = useAuthStatus()

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background text-muted-foreground">
        Loading...
      </div>
    )
  }

  return (
    <RecordProvider allowAnonymous>
      <RecordScope roomId={SCOPE_ID} schemas={schemas} appId={APP_NAME}>
        {children}
      </RecordScope>
    </RecordProvider>
  )
}
