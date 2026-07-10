/**
 * Navigation Config
 *
 * Add one entry per nav item. Routes are handled by generouted
 * (file-based routing in src/pages/), this just controls what
 * appears in the navigation bar.
 *
 * Tabs mirror the original HyperFoodie header: Add Recipe / My Recipes /
 * Grocery List. Icons + the grocery badge are wired up in Navigation.tsx.
 */

import type { Role } from './constants'

export interface NavItem {
  path: string
  label: string
  roles?: Role[]
  devOnly?: boolean
}

export const nav: NavItem[] = [
  { path: '/add', label: 'Add' },
  { path: '/recipes', label: 'Recipes' },
  { path: '/discover', label: 'Discover' },
  { path: '/grocery', label: 'Grocery' },
  // ── Features add nav items below this line ──
]
