/**
 * App navigation — Recipe Box handoff spec ("Global chrome › App nav").
 *
 * Sticky warm-cream bar: brand mark (ChefHat on primary square) · centered
 * segmented pill nav on a cream track · Upgrade link + account chip. The
 * grocery tab carries an unchecked-items badge. Brand returns to landing (/).
 */

import { useState, useEffect, type ComponentType } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth, AuthOverlay, useUser, signOut, useQuery } from 'deepspace'
import {
  ChefHat, Plus, BookOpen, ClipboardCheck, Compass, LogOut, CreditCard,
  type LucideProps,
} from 'lucide-react'
import { APP_DISPLAY_NAME, type Role } from '../constants'
import { nav } from '../nav'
import { isGroceryChecked } from '../utils/groceryChecked'
import { effectiveTier } from '../plan-limits'
import { useSubscriptionSafe } from '../hooks/subscription-context'

interface GroceryRecord {
  recordId: string
  data: { checked?: unknown }
}

const NAV_ICONS: Record<string, ComponentType<LucideProps>> = {
  '/add': Plus,
  '/recipes': BookOpen,
  '/discover': Compass,
  '/grocery': ClipboardCheck,
}

export default function Navigation() {
  const { isSignedIn } = useAuth()
  const { user } = useUser()
  const location = useLocation()
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  const sub = useSubscriptionSafe()
  const onFreePlan = !sub.isLoading && effectiveTier(sub) === 'free'

  const { records: groceryItems } = useQuery('groceryList') as { records: GroceryRecord[] }
  const uncheckedCount = groceryItems?.filter((i) => !isGroceryChecked(i.data?.checked)).length ?? 0

  const userRole = (user?.role ?? 'anonymous') as Role | 'anonymous'

  useEffect(() => { setUserMenuOpen(false) }, [location.pathname])

  const visibleNav = nav.filter((item) => {
    if (item.devOnly && !import.meta.env.DEV) return false
    if (!item.roles) return true
    if (userRole === 'admin') return true
    return item.roles.includes(userRole as Role)
  })

  // Recipes stays highlighted on /recipes/:id (handoff "Active nav state").
  const isActive = (path: string) =>
    path === '/add' ? location.pathname === '/add' : location.pathname.startsWith(path)

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-[12px]">
      <nav
        data-testid="app-navigation"
        className="mx-auto flex h-[66px] max-w-[1160px] items-center justify-between gap-3 px-7 max-sm:px-4"
      >
        {/* Brand — returns to landing */}
        <Link to="/" className="flex shrink-0 items-center gap-2.5">
          <span className="flex h-[38px] w-[38px] items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-[0_6px_14px_-4px_rgba(226,87,11,0.6)]">
            <ChefHat className="h-5 w-5" strokeWidth={2} />
          </span>
          <span className="hidden text-xl font-extrabold tracking-[-0.02em] text-ink md:block">
            {APP_DISPLAY_NAME}
          </span>
        </Link>

        {/* Segmented pill nav */}
        <div className="flex items-center rounded-full bg-cream p-1">
          {visibleNav.map((item) => {
            const active = isActive(item.path)
            const Icon = NAV_ICONS[item.path]
            const badge = item.path === '/grocery' && uncheckedCount > 0 ? uncheckedCount : null
            return (
              <Link
                key={item.path}
                to={item.path}
                aria-current={active ? 'page' : undefined}
                title={item.label}
                className={`flex h-9 items-center gap-2 rounded-full px-4 text-[13.5px] font-semibold transition-colors duration-150 max-sm:px-3 ${
                  active
                    ? 'bg-card text-primary shadow-[0_2px_6px_rgba(61,35,20,0.12)]'
                    : 'text-[#8a6a4a] hover:text-ink'
                }`}
              >
                {Icon && <Icon className="h-[15px] w-[15px] shrink-0" strokeWidth={2} />}
                <span className="hidden sm:inline">{item.label}</span>
                {badge !== null && (
                  <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10.5px] font-bold leading-none text-primary-foreground">
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
              </Link>
            )
          })}
        </div>

        {/* Account cluster */}
        <div className="flex shrink-0 items-center gap-3">
          {isSignedIn && onFreePlan && (
            <Link
              to="/pricing"
              className="hidden text-[13.5px] font-semibold text-primary-deep transition-colors duration-150 hover:text-primary sm:block"
            >
              Upgrade
            </Link>
          )}
          {isSignedIn && user ? (
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen((prev) => !prev)}
                className="flex items-center gap-2 rounded-full bg-cream py-1 pl-1 pr-3 transition-colors duration-150 hover:bg-muted"
              >
                <span className="flex h-[30px] w-[30px] items-center justify-center overflow-hidden rounded-full bg-primary text-[13px] font-bold text-primary-foreground">
                  {user.imageUrl ? (
                    <img src={user.imageUrl} alt="" className="h-[30px] w-[30px] rounded-full object-cover" />
                  ) : (
                    (user.name?.[0] ?? user.email?.[0] ?? '?').toUpperCase()
                  )}
                </span>
                <span data-testid="nav-user-name" className="hidden max-w-[110px] truncate text-[13.5px] font-semibold text-secondary-foreground sm:inline">
                  {user.name || user.email}
                </span>
              </button>
              {userMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                  <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-52 overflow-hidden rounded-2xl border border-border bg-card shadow-[0_12px_26px_-18px_rgba(61,35,20,0.4)]">
                    <div className="border-b border-border px-3 py-2.5">
                      <div className="truncate text-sm font-bold text-ink">{user.name || 'Signed in'}</div>
                      <div className="truncate text-xs text-muted-foreground">{user.email}</div>
                    </div>
                    <Link
                      to="/pricing"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-body-soft transition-colors duration-150 hover:bg-accent hover:text-ink"
                    >
                      <CreditCard className="h-4 w-4" strokeWidth={2} />
                      Billing &amp; plans
                    </Link>
                    <button
                      onClick={() => { setUserMenuOpen(false); signOut() }}
                      className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-body-soft transition-colors duration-150 hover:bg-accent hover:text-ink"
                    >
                      <LogOut className="h-4 w-4" strokeWidth={2} />
                      Sign out
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <button
              data-testid="nav-sign-in-button"
              onClick={() => setShowAuthModal(true)}
              className="h-[38px] rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground shadow-[0_10px_20px_-8px_rgba(226,87,11,0.7)] transition-colors duration-150 hover:bg-primary-deep"
            >
              Sign In
            </button>
          )}
        </div>
      </nav>
      </header>

      {/* Rendered OUTSIDE <header>: the header's backdrop-blur establishes a
          containing block for position:fixed, which would clip and mis-center
          the auth overlay to the 66px bar instead of the viewport. */}
      {showAuthModal && <AuthOverlay onClose={() => setShowAuthModal(false)} />}
    </>
  )
}
