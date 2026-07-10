/**
 * Recipe app collections — stored as typed columns; array fields use JSON interpretation.
 */

import type { CollectionSchema } from 'deepspace/worker'

const stdPerms: CollectionSchema['permissions'] = {
  viewer: { read: 'own', create: true, update: 'own', delete: 'own' },
  member: { read: 'own', create: true, update: 'own', delete: 'own' },
  admin: { read: true, create: true, update: true, delete: true },
}

export const recipesSchema: CollectionSchema = {
  name: 'recipes',
  columns: [
    { name: 'ownerId', storage: 'text', interpretation: 'plain', userBound: true, immutable: true },
    { name: 'title', storage: 'text', interpretation: 'plain' },
    { name: 'caption', storage: 'text', interpretation: 'plain' },
    { name: 'ingredients', storage: 'text', interpretation: { kind: 'json' } },
    { name: 'instructions', storage: 'text', interpretation: { kind: 'json' } },
    { name: 'imageUrl', storage: 'text', interpretation: 'plain' },
    { name: 'instagramUrl', storage: 'text', interpretation: 'plain' },
    { name: 'author', storage: 'text', interpretation: 'plain' },
    { name: 'savedAt', storage: 'text', interpretation: 'plain' },
    { name: 'tags', storage: 'text', interpretation: { kind: 'json' } },
    { name: 'starred', storage: 'text', interpretation: { kind: 'boolean' } },
    { name: 'notes', storage: 'text', interpretation: 'plain' },
    { name: 'recipeSourceUrl', storage: 'text', interpretation: 'plain' },
    { name: 'mealType', storage: 'text', interpretation: 'plain' },
    { name: 'keyIngredients', storage: 'text', interpretation: { kind: 'json' } },
    // AI-estimated nutrition, per serving (approximate)
    { name: 'calories', storage: 'number', interpretation: 'plain' },
    { name: 'protein', storage: 'number', interpretation: 'plain' },
    { name: 'servings', storage: 'number', interpretation: 'plain' },
  ],
  ownerField: 'ownerId',
  permissions: stdPerms,
}

export const pantrySchema: CollectionSchema = {
  name: 'pantry',
  columns: [
    { name: 'ownerId', storage: 'text', interpretation: 'plain', userBound: true, immutable: true },
    { name: 'ingredient', storage: 'text', interpretation: 'plain' },
    { name: 'addedAt', storage: 'text', interpretation: 'plain' },
    { name: 'category', storage: 'text', interpretation: 'plain' },
  ],
  ownerField: 'ownerId',
  permissions: stdPerms,
}

/**
 * One row per successful link extraction — used to meter monthly extraction
 * quotas per plan (see src/plan-limits.ts). Rows are never edited, only
 * created; the quota check counts rows with `at` in the current month.
 */
export const extractionLogSchema: CollectionSchema = {
  name: 'extractionLog',
  columns: [
    { name: 'ownerId', storage: 'text', interpretation: 'plain', userBound: true, immutable: true },
    { name: 'at', storage: 'text', interpretation: 'plain' },
    { name: 'sourceUrl', storage: 'text', interpretation: 'plain' },
  ],
  ownerField: 'ownerId',
  permissions: {
    viewer: { read: 'own', create: true, update: false, delete: false },
    member: { read: 'own', create: true, update: false, delete: false },
    admin: { read: true, create: true, update: true, delete: true },
  },
}

export const groceryListSchema: CollectionSchema = {
  name: 'groceryList',
  columns: [
    { name: 'ownerId', storage: 'text', interpretation: 'plain', userBound: true, immutable: true },
    { name: 'ingredient', storage: 'text', interpretation: 'plain' },
    { name: 'recipeId', storage: 'text', interpretation: 'plain' },
    { name: 'recipeTitle', storage: 'text', interpretation: 'plain' },
    { name: 'checked', storage: 'number', interpretation: { kind: 'boolean' } },
    { name: 'addedAt', storage: 'text', interpretation: 'plain' },
  ],
  ownerField: 'ownerId',
  permissions: stdPerms,
}
