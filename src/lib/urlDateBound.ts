/**
 * Date bounds as they travel through the URL.
 *
 * Pure functions over `URLSearchParams` and plain YYYY-MM-DD strings — no
 * React, no router, no feature knowledge — so they live beside the other date
 * primitives (`calendarDate`, `dateUtils`) rather than inside the paged-feed
 * hook that happened to need them first. Reading a date out of the URL has
 * nothing to do with paging, and a tab that never paginates should be able to
 * reuse these without importing a hook it has no use for.
 */

import { isRealCalendarDate } from '@/lib/calendarDate'

/**
 * One optional date bound as it travels through the URL.
 *
 * A present-but-unusable value is NOT silently replaced: the URL would then
 * disagree with both the field and the request. It goes down the same path as
 * an inverted range — inline hint, no request — tracked per bound (`isInvalid`)
 * so the hint can sit on the field that actually holds the bad value. An
 * absent (or empty) parameter stays a plain "no value" (`value: undefined`);
 * what "no value" MEANS — no bound, or the tab's default — is the tab's call.
 */
export interface UrlDateBound {
  /** True when the raw value was present but is not a real calendar date. */
  isInvalid: boolean
  /** The usable YYYY-MM-DD value; undefined when absent OR invalid. */
  value: string | undefined
}

/**
 * Read one date bound off the committed URL params.
 *
 * `isRealCalendarDate`, not a shape-only regex: V8's `Date.parse` lazily reads
 * an impossible day like 2026-02-31 as March 3rd, so a shape check would wave
 * it through to the API as a date nobody typed.
 */
export function readUrlDateBound(searchParams: URLSearchParams, key: string): UrlDateBound {
  const raw = searchParams.get(key)
  const isInvalid = !!raw && !isRealCalendarDate(raw)
  return { isInvalid, value: raw && !isInvalid ? raw : undefined }
}

/**
 * Manual input can bypass the pickers' min/max, so an inverted window must not
 * reach the API. ISO YYYY-MM-DD strings compare correctly as strings. Only a
 * FULLY specified window can be inverted — a single bound is a legitimate
 * open-ended filter where the tab allows one (backend rule, same branch).
 */
export function isDatePairInverted(from: string | undefined, to: string | undefined): boolean {
  return !!from && !!to && from > to
}
