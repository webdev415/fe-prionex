/**
 * User Form Validation Schemas
 *
 * Zod schemas for user creation and update forms.
 * Provides type-safe validation with helpful error messages.
 */

import { z } from 'zod'

/**
 * Password validation rules
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character
 */
const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character')

/**
 * Email validation
 */
const emailSchema = z.string().email('Invalid email address')

/**
 * Phone number validation (E.164 format)
 * Examples: +1-555-0101, +44-20-7123-4567
 */
const phoneSchema = z
  .string()
  .regex(/^\+[1-9]\d{0,3}-\d{1,14}$/, 'Phone must be in E.164 format (e.g., +1-555-0101)')
  .optional()
  .or(z.literal(''))

/**
 * Username validation
 * - 3-50 characters
 * - Alphanumeric, dots, underscores, hyphens only
 */
const usernameSchema = z
  .string()
  .min(3, 'Username must be at least 3 characters')
  .max(50, 'Username must be at most 50 characters')
  .regex(
    /^[a-zA-Z0-9._-]+$/,
    'Username can only contain letters, numbers, dots, underscores, and hyphens'
  )

/**
 * Name field validation
 */
const nameSchema = z
  .string()
  .min(1, 'This field is required')
  .max(100, 'Name must be at most 100 characters')

/**
 * Optional name field validation
 */
const optionalNameSchema = z
  .string()
  .max(100, 'Name must be at most 100 characters')
  .optional()
  .or(z.literal(''))

/**
 * Language options
 */
export const languageOptions = [
  { value: 'en', label: 'English' },
  { value: 'uk', label: 'Ukrainian' },
  { value: 'ru', label: 'Russian' },
] as const

/**
 * Create User Form Schema
 *
 * Validation for creating a new user.
 * Note: project_assignments are handled separately in the form components.
 */
export const createUserSchema = z.object({
  username: usernameSchema,
  email: emailSchema,
  password: passwordSchema,
  first_name: nameSchema,
  last_name: nameSchema,
  middle_name: optionalNameSchema,
  phone: phoneSchema,
  language: z.enum(['en', 'uk', 'ru'], {
    message: 'Please select a language',
  }),
  timezone: z.string().min(1, 'Please select a timezone'),
  must_change_password: z.boolean().default(true),
  asterisk_extension: z.string().regex(/^\d{3,10}$/, 'Extension must be 3-10 digits').optional().or(z.literal('')),
  is_agent: z.boolean().optional().default(false),
})

/**
 * Update User Form Schema
 *
 * Validation for updating an existing user.
 * Note: Cannot update username or password (separate endpoints exist for password reset)
 * Note: project_assignments are handled separately in the form components.
 */
export const updateUserSchema = z.object({
  email: emailSchema,
  first_name: nameSchema,
  last_name: nameSchema,
  middle_name: optionalNameSchema,
  phone: phoneSchema,
  language: z.enum(['en', 'uk', 'ru'], {
    message: 'Please select a language',
  }),
  timezone: z.string().min(1, 'Please select a timezone'),
  asterisk_extension: z.string().regex(/^\d{3,10}$/, 'Extension must be 3-10 digits').optional().or(z.literal('')),
  is_agent: z.boolean().optional(),
})

/**
 * Infer TypeScript types from schemas
 */
export type CreateUserFormData = z.infer<typeof createUserSchema>
export type UpdateUserFormData = z.infer<typeof updateUserSchema>

/**
 * Common timezone options
 * Note: In production, this should be a comprehensive list or fetched from an API
 */
export const timezoneOptions = [
  { value: 'Europe/Kyiv', label: 'Europe/Kyiv (EET/EEST)' }, // Default per backend
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
  { value: 'America/New_York', label: 'America/New York (EST/EDT)' },
  { value: 'America/Chicago', label: 'America/Chicago (CST/CDT)' },
  { value: 'America/Denver', label: 'America/Denver (MST/MDT)' },
  { value: 'America/Los_Angeles', label: 'America/Los Angeles (PST/PDT)' },
  { value: 'Europe/London', label: 'Europe/London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Europe/Paris (CET/CEST)' },
  { value: 'Europe/Kiev', label: 'Europe/Kiev (EET/EEST)' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo (JST)' },
  { value: 'Australia/Sydney', label: 'Australia/Sydney (AEST/AEDT)' },
] as const
