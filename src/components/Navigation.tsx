/**
 * Navigation — a floating, segmented header.
 *
 * Brand chip · centered segmented tabs (icon + label, icon-only on mobile) ·
 * account cluster — all inside one rounded, blurred bar that floats inset from
 * the screen edges so the layout feels soft rather than boxed-in.
 */

import { useState, useEffect, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth, AuthOverlay, useUser, signOut, useQuery } from 'deepspace'
import { APP_NAME, type Role } from '../constants'
import { nav } from '../nav'
import { isGroceryChecked } from '../utils/groceryChecked'

interface GroceryRecord {
  recordId: string
  data: { checked?: unknown }
}

const NAV_ICONS: Record<string, ReactNode> = {
  '/home': (
    <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  ),
  '/recipes': (
    <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  ),
  '/grocery': (
    <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  ),
}

export default function Navigation() {
  const { isSignedIn } = useAuth()
  const { user } = useUser()
  const location = useLocation()
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)

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

  const isActive = (path: string) =>
    path === '/home' ? location.pathname === '/home' : location.pathname.startsWith(path)

  return (
    <header className="px-3 pt-3 sm:px-4">
      <nav
        data-testid="app-navigation"
        className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-2 rounded-2xl border border-border bg-card/70 pl-2 pr-2 shadow-card backdrop-blur-xl sm:rounded-full sm:pl-2.5 sm:pr-2.5"
      >
        {/* Brand */}
        <Link to="/home" className="flex shrink-0 items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
          </span>
          <span className="hidden text-sm font-bold tracking-tight text-foreground md:block">
            {APP_NAME}
          </span>
        </Link>

        {/* Segmented tabs */}
        <div className="flex items-center gap-1 rounded-full bg-secondary/70 p-1">
          {visibleNav.map((item) => {
            const active = isActive(item.path)
            const badge = item.path === '/grocery' && uncheckedCount > 0 ? uncheckedCount : null
            return (
              <Link
                key={item.path}
                to={item.path}
                aria-current={active ? 'page' : undefined}
                title={item.label}
                className={`relative flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition-all ${
                  active
                    ? 'bg-card text-primary shadow-sm'
                    : 'text-content-secondary hover:text-content'
                }`}
              >
                <span className={active ? 'text-primary' : ''}>{NAV_ICONS[item.path]}</span>
                <span className="hidden sm:inline">{item.label}</span>
                {badge !== null && (
                  <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-primary-foreground">
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
              </Link>
            )
          })}
        </div>

        {/* Account */}
        <div className="flex shrink-0 items-center gap-2">
          {isSignedIn && user ? (
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen((prev) => !prev)}
                className="flex items-center gap-2 rounded-full border border-border bg-card/60 py-1 pl-1 pr-2.5 transition-colors hover:bg-card"
              >
                <span className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-primary/15 text-xs font-semibold text-primary">
                  {user.imageUrl ? (
                    <img src={user.imageUrl} alt="" className="h-7 w-7 rounded-full object-cover" />
                  ) : (
                    (user.name?.[0] ?? user.email?.[0] ?? '?').toUpperCase()
                  )}
                </span>
                <span data-testid="nav-user-name" className="hidden max-w-[110px] truncate text-sm text-content-secondary sm:inline">
                  {user.name || user.email}
                </span>
              </button>
              {userMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                  <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-52 overflow-hidden rounded-2xl border border-border bg-card shadow-card-hover">
                    <div className="border-b border-border px-3 py-2.5">
                      <div className="truncate text-sm font-semibold text-foreground">{user.name || 'Signed in'}</div>
                      <div className="truncate text-xs text-muted-foreground">{user.email}</div>
                    </div>
                    <button
                      onClick={() => { setUserMenuOpen(false); signOut() }}
                      className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-content-secondary transition-colors hover:bg-secondary hover:text-content"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
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
              className="rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
            >
              Sign In
            </button>
          )}
        </div>
      </nav>

      {showAuthModal && <AuthOverlay onClose={() => setShowAuthModal(false)} />}
    </header>
  )
}
