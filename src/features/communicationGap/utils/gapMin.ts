/**
 * Parsing for the `gap_min` filter as it travels through the URL.
 *
 * The field is optional (empty = no minimum) and the backend accepts an
 * integer in `[0 .. 2147483647]`, answering 422 for anything else. The value
 * reaches the tab as a raw string — typed into a text input (a number input
 * would blank an unusable one instead of showing it back) or read from a
 * hand-edited URL — so it is validated here and a bad one shows an inline hint
 * instead of firing a request the backend would reject.
 *
 * Same rule and the same shape as the sibling feed's `parseMaxVerified`, kept
 * feature-local rather than shared: the two filters are opposites (a cap on
 * verifications vs a floor on days of silence) and each tab owns the copy it
 * documents, exactly as both feed tabs own their own `parsePositiveInt` for the
 * page keys.
 */

/** Mirrors the backend's `le=2_147_483_647` bound (int32 ceiling). */
export const GAP_MIN_CEILING = 2_147_483_647

export interface GapMinParse {
  /** The usable filter value; `undefined` means "no minimum requested". */
  value: number | undefined
  /** True when the raw string was present but not a usable value. */
  isInvalid: boolean
}

/**
 * Parse a raw URL value into a `gap_min` filter.
 *
 * Only non-negative integers pass. `"0"` is legitimate — it is the backend's
 * `ge=0` floor and semantically means "every row" — so the result carries
 * `undefined` vs `0` explicitly rather than leaning on falsiness anywhere
 * downstream.
 */
export function parseGapMin(raw: string | null | undefined): GapMinParse {
  if (raw === null || raw === undefined || raw.trim() === '') {
    return { value: undefined, isInvalid: false }
  }
  // Digits only: rejects "-1", "1.5", "1e3", "abc" and any whitespace padding
  // in one predicate, which keeps the client's rule identical to the backend's
  // "integer >= 0" without a second parsing path.
  if (!/^\d+$/.test(raw)) return { value: undefined, isInvalid: true }
  const parsed = Number(raw)
  if (!Number.isSafeInteger(parsed) || parsed > GAP_MIN_CEILING) {
    return { value: undefined, isInvalid: true }
  }
  return { value: parsed, isInvalid: false }
}
