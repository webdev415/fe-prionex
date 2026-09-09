/**
 * Pure YYYY-MM-DD window arithmetic for the feed's date-pair guard.
 *
 * String math over the bounds as STRINGS, never `new Date("YYYY-MM-DD")` kept
 * as a Date: a bare YYYY-MM-DD parses as UTC midnight, which west of
 * Greenwich reads back as the previous local day. `Date.parse` is safe here
 * because BOTH bounds parse as UTC midnights, so their DIFFERENCE is exact
 * whatever the host timezone is — the value is never read back as a local
 * calendar day.
 */

/**
 * Mirrors the backend's window cap: the (date_to - date_from) day difference
 * may be at most 366, i.e. an inclusive window of 367 days is the widest
 * allowed — larger answers 400. Same cap as promises-daily and
 * operator-promises.
 */
export const MAX_RANGE_DAYS = 366

const MS_PER_DAY = 86_400_000

/**
 * True when the window's day difference exceeds the backend cap. An inverted
 * pair is NOT "too long" — it is the inversion guard's finding, and reporting
 * it twice would show two alerts for one mistake.
 */
export function isWindowTooLong(dateFrom: string, dateTo: string): boolean {
  const diff = (Date.parse(dateTo) - Date.parse(dateFrom)) / MS_PER_DAY
  return diff > MAX_RANGE_DAYS
}
