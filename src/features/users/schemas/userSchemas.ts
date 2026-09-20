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
  .min(8, 'pages.users.validation.passwordMinLength')
  .regex(/[A-Z]/, 'pages.users.validation.passwordUppercase')
  .regex(/[a-z]/, 'pages.users.validation.passwordLowercase')
  .regex(/[0-9]/, 'pages.users.validation.passwordNumber')
  .regex(/[^A-Za-z0-9]/, 'pages.users.validation.passwordSpecial')

/**
 * Email validation
 */
const emailSchema = z.string().email('pages.users.validation.invalidEmail')

/**
 * Phone number validation (E.164 format)
 * Examples: +1-555-0101, +44-20-7123-4567
 */
const phoneSchema = z
  .string()
  .regex(/^\+[1-9]\d{0,3}-\d{1,14}$/, 'pages.users.validation.phoneFormat')
  .optional()
  .or(z.literal(''))

/**
 * Username validation
 * - 3-50 characters
 * - Alphanumeric, dots, underscores, hyphens only
 */
const usernameSchema = z
  .string()
  .min(3, 'pages.users.validation.usernameMin')
  .max(50, 'pages.users.validation.usernameMax')
  .regex(/^[a-zA-Z0-9._-]+$/, 'pages.users.validation.usernameChars')

/**
 * Name field validation
 */
const nameSchema = z
  .string()
  .min(1, 'pages.users.validation.required')
  .max(100, 'pages.users.validation.nameMax')

/**
 * Optional name field validation
 */
const optionalNameSchema = z
  .string()
  .max(100, 'pages.users.validation.nameMax')
  .optional()
  .or(z.literal(''))

/**
 * Language options
 */
export const languageOptions = [
  { value: 'en', label: 'English' },
  { value: 'uk', label: 'Ukrainian' },
  { value: 'es', label: 'Spanish' },
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
  language: z.enum(['en', 'uk', 'es'], {
    message: 'pages.users.validation.selectLanguage',
  }),
  timezone: z.string().min(1, 'pages.users.validation.selectTimezone'),
  must_change_password: z.boolean().default(true),
  asterisk_extension: z
    .string()
    .regex(/^\d{3,10}$/, 'pages.users.validation.extensionDigits')
    .optional()
    .or(z.literal('')),
  dialer_extension: z
    .string()
    .regex(/^\d{3,10}$/, 'pages.users.validation.extensionDigits')
    .optional()
    .or(z.literal('')),
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
  language: z.enum(['en', 'uk', 'es'], {
    message: 'pages.users.validation.selectLanguage',
  }),
  timezone: z.string().min(1, 'pages.users.validation.selectTimezone'),
  asterisk_extension: z
    .string()
    .regex(/^\d{3,10}$/, 'pages.users.validation.extensionDigits')
    .optional()
    .or(z.literal('')),
  dialer_extension: z
    .string()
    .regex(/^\d{3,10}$/, 'pages.users.validation.extensionDigits')
    .optional()
    .or(z.literal('')),
  is_agent: z.boolean().optional(),
})

/**
 * An agent needs a line to be reached on, so Asterisk Extension is required
 * once Is Agent is checked. Predictive Dialer Extension stays optional.
 *
 * Written as a standalone refinement rather than baked into either schema
 * because the two call sites need it at different moments. Creating a user is
 * unconditional -- there is no history to respect. Editing one is not: a
 * handful of accounts predate this rule and are already agents with no
 * extension, and blocking their form over a field the admin never touched
 * would make an inherited inconsistency into their problem. The edit path
 * applies this only once the checkbox or the field has been touched.
 *
 * It also cannot live on `createUserSchema` itself: the create form extends
 * that object, and a refined schema is a ZodEffects, which has no `.extend`.
 */
export const AGENT_EXTENSION_REQUIRED_MESSAGE = 'pages.users.validation.agentExtensionRequired'

export function requireAgentExtension(
  data: { is_agent?: boolean; asterisk_extension?: string },
  ctx: z.RefinementCtx
): void {
  if (data.is_agent && !data.asterisk_extension) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['asterisk_extension'],
      message: AGENT_EXTENSION_REQUIRED_MESSAGE,
    })
  }
}

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
  { value: 'Europe/Madrid', label: 'Europe/Madrid (CET/CEST)' },
  { value: 'Europe/Paris', label: 'Europe/Paris (CET/CEST)' },
  { value: 'Europe/Kiev', label: 'Europe/Kiev (EET/EEST)' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo (JST)' },
  { value: 'Australia/Sydney', label: 'Australia/Sydney (AEST/AEDT)' },
] as const
