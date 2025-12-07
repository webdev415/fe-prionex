/**
 * Project Form Validation Schemas
 *
 * Zod schemas for project creation and update forms.
 */

import { z } from 'zod'

/**
 * Project code validation
 * - 2-20 characters
 * - Uppercase letters, numbers, underscores, hyphens only
 */
const projectCodeSchema = z
  .string()
  .min(2, 'Project code must be at least 2 characters')
  .max(20, 'Project code must be at most 20 characters')
  .regex(
    /^[A-Z0-9_-]+$/,
    'Project code can only contain uppercase letters, numbers, underscores, and hyphens'
  )

/**
 * Project name validation
 */
const projectNameSchema = z
  .string()
  .min(3, 'Project name must be at least 3 characters')
  .max(100, 'Project name must be at most 100 characters')

/**
 * Project description validation (optional)
 */
const projectDescriptionSchema = z
  .string()
  .max(500, 'Description must be at most 500 characters')
  .optional()
  .or(z.literal(''))

/**
 * Create Project Form Schema
 */
export const createProjectSchema = z.object({
  name: projectNameSchema,
  code: projectCodeSchema,
  description: projectDescriptionSchema,
})

/**
 * Update Project Form Schema
 */
export const updateProjectSchema = z.object({
  name: projectNameSchema,
  code: projectCodeSchema,
  description: projectDescriptionSchema,
})

/**
 * Infer TypeScript types from schemas
 */
export type CreateProjectFormData = z.infer<typeof createProjectSchema>
export type UpdateProjectFormData = z.infer<typeof updateProjectSchema>
