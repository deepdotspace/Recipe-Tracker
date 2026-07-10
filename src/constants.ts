/** App name — replaced by the CLI during scaffolding */
export const APP_NAME = 'recipe-tracker'

/** Brand shown to humans (nav wordmark, landing, titles) — per the Recipe Box
 * design handoff. APP_NAME above is the technical id (scope, deploy); never
 * swap one for the other. */
export const APP_DISPLAY_NAME = 'Recipe Box'

/** Primary scope ID for the app's RecordRoom DO */
export const SCOPE_ID = `app:${APP_NAME}`

/** Roles and display config — imported from SDK (single source of truth) */
export { ROLES, ROLE_CONFIG, type Role } from 'deepspace'

// ---------------------------------------------------------------------------
// Recipe domain constants
// ---------------------------------------------------------------------------

export type MealType = 'breakfast' | 'dinner' | 'dessert' | 'snack' | 'other'

export const MEAL_TYPE_OPTIONS: { value: MealType; label: string }[] = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'dessert', label: 'Dessert' },
  { value: 'snack', label: 'Snack' },
  { value: 'other', label: 'Other' },
]

export const MEAL_TYPE_CONFIG: Record<
  MealType,
  { color: 'warning' | 'primary' | 'danger' | 'success' | 'muted' }
> = {
  breakfast: { color: 'warning' },
  dinner: { color: 'primary' },
  dessert: { color: 'danger' },
  snack: { color: 'success' },
  other: { color: 'muted' },
}

/**
 * Meal-type accent colors from the Recipe Box design handoff — used for the
 * small dot + label chips on recipe cards/detail. Handoff-final hex values;
 * intentionally not theme tokens (they must hold on white photo-chip pills).
 */
export const MEAL_ACCENT: Record<MealType, string> = {
  breakfast: '#c98a1e',
  dinner: '#e2570b',
  dessert: '#b8446a',
  snack: '#6b8e23',
  other: '#8a7256',
}
