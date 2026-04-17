/**
 * Phone normalization helpers for Ukrainian numbers.
 *
 * Database numbers are expected in "380XXXXXXXXX" format.
 */

const DIGITS_ONLY = /\D/g

function stripToDigits(value: string): string {
  return value.replace(DIGITS_ONLY, '')
}

/**
 * Normalize a raw phone value to DB format: 380XXXXXXXXX.
 * Returns null when the value cannot be safely normalized.
 */
export function normalizeUkrainePhoneToDb(value?: string | null): string | null {
  if (!value) return null

  const digits = stripToDigits(value)
  if (!digits) return null

  if (digits.startsWith('380') && digits.length === 12) return digits
  if (digits.startsWith('0') && digits.length === 10) return `38${digits}`
  if (digits.length === 9) return `380${digits}`

  return null
}

/**
 * Format a phone value for UI display.
 * If the number can be normalized, show it as +380XXXXXXXXX.
 */
export function formatUkrainePhoneForDisplay(value?: string | null, fallback = '-'): string {
  if (!value?.trim()) return fallback

  const normalized = normalizeUkrainePhoneToDb(value)
  if (normalized) return `+${normalized}`

  return value.trim()
}
