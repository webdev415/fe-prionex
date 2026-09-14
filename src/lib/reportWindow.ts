/**
 * The report window's SIZE rule, mirrored from the backend.
 *
 * This module exists because the cap is not ours: it is a copy of a server
 * contract (`_MAX_RANGE_DAYS` in
 * `api-prionex/services/client/app/routers/reports.py`), kept on the client so
 * an impossible window is refused in the field instead of coming back as a
 * raw 400. A mirror has one failure mode — the original moves and the copy
 * does not — and the copy is only findable if it lives somewhere whose name
 * says "report window rules". Before this module the number existed SIX times
 * (two feature utils plus four inline re-implementations), so a change to the
 * contract meant finding six places and the divergence would have surfaced as
 * a user picking a window the UI allowed and the API refused.
 *
 * Deliberately NOT in `lib/urlDateBound.ts`, which is the other half of the
 * same screen's validation: that module answers "how does a date travel
 * through the query string" (reading a bound, rejecting 2026-02-31, catching
 * an inverted pair) and its neighbours are URL primitives. A window-size
 * limit is not a transport question. `isDatePairInverted` stays there for the
 * same reason; the one tab that uses both side by side is `PromisesDailyTab`.
 */

/**
 * The widest window the capped report endpoints still answer: the
 * (`date_to` - `date_from`) day DIFFERENCE may be at most 366, i.e. an
 * inclusive window of 367 days. Larger answers 400.
 *
 * ONLY SIX ENDPOINTS CAP THEIR WINDOW AT THIS NUMBER (seven checks — the
 * verification report measures two windows), and this is not a detail to
 * gloss:
 * `/processing`, `/third-party-verification` (both of its windows),
 * `/operator-promises`, `/feeds/promises`, `/feeds/callbacks` and
 * `/promises-daily` (`grep _MAX_RANGE_DAYS` in the router). The other feeds —
 * low-verification, searcher-followup, inbound-followup, communication-gap,
 * contact-tag — carry an explicit `# No _MAX_RANGE_DAYS cap here on purpose`
 * because their cost is bounded by something other than the window, and most
 * of their tabs say so in their own docstrings (`ContactTagFeedTab` is the one
 * that does not). `/outbound-calls` is capped by a
 * DIFFERENT rule: `_OUTBOUND_CALLS_MAX_WINDOW_DAYS = 90`, counted
 * INCLUSIVELY (`(end - start).days + 1`), so neither the number nor the
 * arithmetic here applies to it.
 *
 * Importing this into an uncapped tab would refuse windows the API serves
 * happily — a self-inflicted restriction no error message would explain.
 */
export const MAX_RANGE_DAYS = 366

const MS_PER_DAY = 86_400_000

/**
 * True when the window's day difference exceeds the backend cap.
 *
 * String math over the bounds as STRINGS, never `new Date("YYYY-MM-DD")` kept
 * as a Date: a bare YYYY-MM-DD parses as UTC midnight, which west of
 * Greenwich reads back as the previous local day. `Date.parse` is safe here
 * because BOTH bounds parse as UTC midnights, so their DIFFERENCE is exact
 * whatever the host timezone is — the value is never read back as a local
 * calendar day.
 *
 * An absent or unparseable bound answers false: `Date.parse` gives NaN and
 * every comparison against NaN is false. That is the pre-existing behaviour
 * of all six call sites and is correct here — an unusable date is the
 * invalid-date guard's finding, not this one's.
 *
 * An inverted pair is NOT "too long" either: the difference goes negative and
 * this answers false, leaving the finding to the tabs' inversion guard
 * (`isDatePairInverted` in `PromisesDailyTab`, an inline `from > to` in the
 * other five). Reporting one mistake twice would show two alerts for one typo.
 * EVERY call site — all seven of them, across six files — still writes
 * `!isInverted && isWindowTooLong(...)`; that guard is redundant rather than
 * wrong, and it is kept because it makes the reading order of the two checks
 * visible where the error messages are chosen.
 */
export function isWindowTooLong(dateFrom: string, dateTo: string): boolean {
  const diff = (Date.parse(dateTo) - Date.parse(dateFrom)) / MS_PER_DAY
  return diff > MAX_RANGE_DAYS
}
