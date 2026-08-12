/**
 * Parsing for the `max_verified` filter as it travels through the URL.
 *
 * The field is optional (empty = no cap) and the backend accepts an integer in
 * `[0 .. 2147483647]`, answering 422 for anything else. The number input keeps
 * a user inside that range, but the URL is hand-editable, so a value read back
 * from it is validated here and a bad one shows an inline hint instead of
 * firing a request the backend would reject.
 */

/** Mirrors the backend's `le=2_147_483_647` bound (int32 ceiling). */
export const MAX_VERIFIED_CEILING = 2_147_483_647

export interface MaxVerifiedParse {
  /** The usable filter value; `undefined` means "no cap requested". */
  value: number | undefined
  /** True when the raw string was present but not a usable value. */
  isInvalid: boolean
}

/**
 * Parse a raw URL value into a `max_verified` filter.
 *
 * Only non-negative integers pass — `"0"` is a legitimate (and the most
 * useful) value, so the result carries `undefined` vs `0` explicitly rather
 * than leaning on falsiness anywhere downstream.
 */
export function parseMaxVerified(raw: string | null | undefined): MaxVerifiedParse {
  if (raw === null || raw === undefined || raw.trim() === '') {
    return { value: undefined, isInvalid: false }
  }
  // Digits only: rejects "-1", "1.5", "1e3", "abc" and any whitespace padding
  // in one predicate, which keeps the client's rule identical to the backend's
  // "integer >= 0" without a second parsing path.
  if (!/^\d+$/.test(raw)) return { value: undefined, isInvalid: true }
  const parsed = Number(raw)
  if (!Number.isSafeInteger(parsed) || parsed > MAX_VERIFIED_CEILING) {
    return { value: undefined, isInvalid: true }
  }
  return { value: parsed, isInvalid: false }
}
