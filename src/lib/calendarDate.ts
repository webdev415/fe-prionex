/**
 * Calendar-day validation for ISO date strings carried in the URL.
 *
 * Started inside the third-party verification tab and moved here once the
 * low-verification feed needed the identical guard: a pure util must not drag
 * a feature's module graph (and its import cycles) into every consumer — the
 * same reasoning that moved `gradientRedToGreen` into `@/lib/gradient`.
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/**
 * True only for a REAL calendar day in ISO YYYY-MM-DD form.
 *
 * The shape alone is not enough: a hand-edited URL can carry an impossible day
 * (`?sf=2026-02-31`, `?cf=2026-13-01`). Such a bound would poison every check
 * that follows, because comparisons against NaN are all false — a range guard
 * would pass silently and the request would reach the API — while the picker
 * would display yet another day (`new Date(2026, 1, 31)` → 03.03.2026).
 * Hence the round trip: re-formatting the parsed instant must reproduce the
 * original string, which also rejects any day the parser silently rolls over.
 */
export function isRealCalendarDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false
  const parsed = Date.parse(`${value}T00:00:00Z`)
  if (Number.isNaN(parsed)) return false
  return new Date(parsed).toISOString().slice(0, 10) === value
}
