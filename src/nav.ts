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
  { path: '/home', label: 'Add Recipe' },
  { path: '/recipes', label: 'My Recipes' },
  { path: '/grocery', label: 'Grocery List' },
  // ── Features add nav items below this line ──
]
