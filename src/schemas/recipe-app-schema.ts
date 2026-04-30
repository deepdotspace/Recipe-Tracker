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

export const groceryListSchema: CollectionSchema = {
  name: 'groceryList',
  columns: [
    { name: 'ownerId', storage: 'text', interpretation: 'plain', userBound: true, immutable: true },
    { name: 'ingredient', storage: 'text', interpretation: 'plain' },
    { name: 'recipeId', storage: 'text', interpretation: 'plain' },
    { name: 'recipeTitle', storage: 'text', interpretation: 'plain' },
    { name: 'checked', storage: 'text', interpretation: { kind: 'boolean' } },
    { name: 'addedAt', storage: 'text', interpretation: 'plain' },
  ],
  ownerField: 'ownerId',
  permissions: stdPerms,
}
