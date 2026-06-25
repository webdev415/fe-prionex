/**
 * IPv4 validation for the global IP whitelist forms.
 *
 * Mirrors the backend Pydantic validator: single IPv4 address only
 * (no CIDR, no IPv6).
 */

import { z } from 'zod'

export const ipv4Schema = z
  .string()
  .trim()
  .min(7, 'IP address is required')
  .refine((value) => !value.includes('/'), {
    message: 'CIDR ranges are not allowed; enter a single IPv4 address',
  })
  .refine(
    (value) => {
      const parts = value.split('.')
      if (parts.length !== 4) return false
      return parts.every((p) => /^\d{1,3}$/.test(p) && Number(p) >= 0 && Number(p) <= 255)
    },
    { message: 'Invalid IPv4 address (expected format: 203.0.113.5)' }
  )

export const labelSchema = z
  .string()
  .max(100, 'Label must be at most 100 characters')
  .optional()
  .or(z.literal(''))

export const ipWhitelistFormSchema = z.object({
  ip_address: ipv4Schema,
  label: labelSchema,
})

export type IpWhitelistFormData = z.infer<typeof ipWhitelistFormSchema>
