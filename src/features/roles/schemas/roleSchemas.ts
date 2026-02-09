/**
 * Role Form Validation Schemas
 *
 * Zod schemas for role creation and update forms.
 */

import { z } from 'zod'

/**
 * Role name validation
 */
const roleNameSchema = z
  .string()
  .min(3, 'Role name must be at least 3 characters')
  .max(50, 'Role name must be at most 50 characters')

/**
 * Role description validation (optional)
 */
const roleDescriptionSchema = z
  .string()
  .max(200, 'Description must be at most 200 characters')
  .optional()
  .or(z.literal(''))

/**
 * Permission IDs validation
 */
const permissionIdsSchema = z.array(z.number()).min(1, 'At least one permission must be selected')

/**
 * Department ID validation (optional)
 */
const departmentIdSchema = z.number().nullable().optional()

/**
 * Create Role Form Schema
 */
export const createRoleSchema = z.object({
  name: roleNameSchema,
  description: roleDescriptionSchema,
  department_id: departmentIdSchema,
  permission_ids: permissionIdsSchema,
})

/**
 * Update Role Form Schema
 */
export const updateRoleSchema = z.object({
  name: roleNameSchema,
  description: roleDescriptionSchema,
  department_id: departmentIdSchema,
  permission_ids: permissionIdsSchema,
})

/**
 * Infer TypeScript types from schemas
 */
export type CreateRoleFormData = z.infer<typeof createRoleSchema>
export type UpdateRoleFormData = z.infer<typeof updateRoleSchema>
