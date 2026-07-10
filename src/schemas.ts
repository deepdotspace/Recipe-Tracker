/**
 * Collection Schemas
 *
 * All collections with columns and RBAC permissions.
 * Single source of truth — imported by both worker and frontend.
 *
 * Add schemas by creating a file in src/schemas/ and importing it here.
 */

import type { CollectionSchema } from 'deepspace/worker'
import { usersSchema } from './schemas/users-schema'
import { settingsSchema } from './schemas/admin-schema'
import { recipesSchema, pantrySchema, groceryListSchema, extractionLogSchema } from './schemas/recipe-app-schema'

export const schemas: CollectionSchema[] = [
  usersSchema,
  settingsSchema,
  recipesSchema,
  pantrySchema,
  groceryListSchema,
  extractionLogSchema,
]
