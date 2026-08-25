/**
 * Parsing for the `max_verified` filter as it travels through the URL.
 *
 * The field is optional (empty = no cap) and the backend accepts an integer in
 * `[0 .. 2147483647]`, answering 422 for anything else. The value reaches the
 * tab as a raw string — typed into a text input (a number input would blank an
 * unusable one instead of showing it back) or read from a hand-edited URL — so
 * it is validated here and a bad one shows an inline hint instead of firing a
 * request the backend would reject.
 */

/** Mirrors the backend's `le=2_147_483_647` bound (int32 ceiling). */
export const MAX_VERIFIED_CEILING = 2_147_483_647

export interface MaxVerifiedParse {
  /** The usable filter value; `undefined` means "no cap requested". */
  value: number | undefined
  /** True when the raw string was present but not a usable value. */
  isInvalid: boolean
  /**
   * True for the SECOND kind of refusal: a perfectly well-formed non-negative
   * integer that exceeds the backend's int32 ceiling. It needs its own flag
   * because the two refusals need different sentences — a user who typed
   * 2147483648 DID enter "a whole number of 0 or more", so that hint would
   * describe everything except their actual violation. Always false when
   * `isInvalid` is false. (Same split as the sibling feed's `parseGapMin`.)
   */
  isTooLarge: boolean
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
    return { value: undefined, isInvalid: false, isTooLarge: false }
  }
  // Digits only: rejects "-1", "1.5", "1e3", "abc" and any whitespace padding
  // in one predicate, which keeps the client's rule identical to the backend's
  // "integer >= 0" without a second parsing path.
  if (!/^\d+$/.test(raw)) return { value: undefined, isInvalid: true, isTooLarge: false }
  const parsed = Number(raw)
  if (!Number.isSafeInteger(parsed) || parsed > MAX_VERIFIED_CEILING) {
    // Digits-only input past the ceiling — including a string so long it left
    // the safe-integer range altogether — is the "too large" refusal, not the
    // "not a whole number" one.
    return { value: undefined, isInvalid: true, isTooLarge: true }
  }
  return { value: parsed, isInvalid: false, isTooLarge: false }
}
