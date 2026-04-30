/** App name — replaced by the CLI during scaffolding */
export const APP_NAME = 'my-third-app'

/** Primary scope ID for the app's RecordRoom DO */
export const SCOPE_ID = `app:${APP_NAME}`

/** Roles and display config — imported from SDK (single source of truth) */
export { ROLES, ROLE_CONFIG, type Role } from 'deepspace'

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
