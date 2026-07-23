import type { ContactSource } from '@/features/clients/api/types'

/**
 * Contact-value validation keyed off a contact type's Contact Source (KAN-812).
 *
 * - Client / Recommender sources are phone types → value must be digits only
 *   (strictly: no +, spaces, dashes, or parentheses — matching how phone
 *   numbers are stored, e.g. 380970306248).
 * - Other source → any characters allowed.
 *
 * Duplicate detection is per client and spans every Contact Source: the same
 * value may not appear on two contacts of the same client, regardless of
 * category or contact type.
 */

/** True when the given Contact Source restricts the value to digits only. */
export function requiresDigitsOnly(source: ContactSource | null | undefined): boolean {
  return source === 'client' || source === 'recommender'
}

/** True when a digits-only value contains any non-digit character. */
export function hasNonDigitChars(value: string): boolean {
  return /\D/.test(value.trim())
}

/** Normalize a contact value for duplicate comparison (trim + case-fold). */
export function normalizeContactValue(value: string): string {
  return value.trim().toLowerCase()
}

export type ComparableContact = {
  id: number
  contactValue: string
}

/**
 * True when `value` already exists on another contact of the same client.
 * `excludeId` is the contact currently being edited, excluded from the
 * comparison against itself. Empty/blank values are never duplicates.
 */
export function isDuplicateContactValue(
  contacts: ComparableContact[],
  value: string,
  excludeId: number | null
): boolean {
  const normalized = normalizeContactValue(value)
  if (!normalized) return false
  return contacts.some(
    (c) => c.id !== excludeId && normalizeContactValue(c.contactValue) === normalized
  )
}
