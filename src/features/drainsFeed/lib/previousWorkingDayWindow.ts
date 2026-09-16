/**
 * The «Зливи» tab's DEFAULT window: the previous working day.
 *
 * A rule, not a preference, and the reason it is a named function with a suite
 * of its own rather than two lines inside the tab. Techno-Finance gives this
 * tab — and only this tab of the whole factoring family — its
 * `window_previous_working_day`, and the client-service port carries the same
 * rule as a tested function (`previous_working_day_window` in
 * `drain_feed_service.py`) precisely so the three consumers cannot drift
 * apart. This module is the third copy by necessity: the API deliberately does
 * NOT apply the rule as its no-dates default, because omitting both dates
 * means the WHOLE HISTORY there (see `DrainsFeedTab` and the endpoint's
 * docstring) — so the default window is a frontend decision, and a frontend
 * that got it wrong would lose a whole weekend of promises without changing
 * anything else visible on the page.
 *
 * THE RULE, literally:
 *
 * * MONDAY → a THREE-day window, `[today − 3 .. today − 1]` = Friday through
 *   Sunday, so work done over the weekend is not lost;
 * * every other day → `[yesterday .. yesterday]`.
 *
 * Saturday and Sunday are left LITERAL (Saturday → Friday, Sunday →
 * Saturday): the source specification special-cases Monday alone, and the
 * shape of the mistake is exactly "generalise the weekend rule".
 *
 * "TODAY" IS NEVER IN THE DEFAULT WINDOW, on any day of the week. That is the
 * sharpest difference from every sibling feed on this page, all of which
 * default to a window ending today (most of them to today–today), and it is
 * what a blind copy of a neighbour's `fallbackFrom: today` would silently
 * undo.
 *
 * NEITHER SIDE HAS A PRODUCTION CALENDAR, so public holidays are not
 * considered by this rule any more than they are by the original: a Tuesday
 * after a Monday holiday defaults to the empty Monday, and the operator widens
 * the window by hand.
 */

import { isRealCalendarDate } from '@/lib/calendarDate'

const MS_PER_DAY = 86_400_000

/** An inclusive `[dateFrom .. dateTo]` pair of YYYY-MM-DD calendar days. */
export interface DrainsDefaultWindow {
  dateFrom: string
  dateTo: string
}

/**
 * Parse a YYYY-MM-DD calendar day into a UTC midnight instant.
 *
 * UTC on both ends — parse and format — so the arithmetic below is pure
 * calendar arithmetic and never reads a day back through the host timezone.
 *
 * The shape test is `isRealCalendarDate`, the shared guard, and NOT a regex of
 * this module's own: a regex accepts `2026-02-31`, which `Date.UTC` then
 * silently rolls over to March 3rd — so a window would be computed from a day
 * that does not exist, and computed plausibly. That is the exact defect the
 * shared guard was extracted for; re-deriving a weaker one here would be the
 * seventh copy of a rule that already has a home.
 */
function parseYmdAsUtc(day: string): number | null {
  if (!isRealCalendarDate(day)) return null
  const [year, month, date] = day.split('-').map(Number)
  return Date.UTC(year, month - 1, date)
}

/** Format a UTC instant back as a YYYY-MM-DD calendar day (UTC getters only). */
function formatUtcAsYmd(instant: number): string {
  const value = new Date(instant)
  const year = String(value.getUTCFullYear()).padStart(4, '0')
  const month = String(value.getUTCMonth() + 1).padStart(2, '0')
  const day = String(value.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * The default window for a given «today».
 *
 * @param today today's calendar day (YYYY-MM-DD) in the operator's PROFILE
 *   timezone — `useTodayInTimezone`'s output, not the browser's day: the same
 *   zone travels to the backend and cuts the window's days there, so both ends
 *   have to agree on which day "today" is (and on which weekday it therefore
 *   is — near midnight the browser and the profile can disagree about Monday).
 * @returns the inclusive window, or `null` when `today` is not a usable
 *   calendar day. A null is the honest answer rather than a silent
 *   today–today: the caller then has no default to fill an absent bound with,
 *   which surfaces as a blocked request instead of as a wrong window. In
 *   practice the input comes from `getDateStringInTimezone`, so this branch is
 *   unreachable from the UI.
 */
export function previousWorkingDayWindow(today: string): DrainsDefaultWindow | null {
  const anchor = parseYmdAsUtc(today)
  if (anchor === null) return null

  // `getUTCDay()` is 0 for Sunday and 1 for Monday — the source system's own
  // `weekday() == 0` test, renumbered. Comparing against 0 here (copied from
  // the Python without renumbering) would hand Sunday the weekend window and
  // leave Monday defaulting to "yesterday" = the empty Sunday, which is the
  // exact failure this rule exists to prevent — and it would look perfectly
  // plausible on every other day of the week.
  const back = new Date(anchor).getUTCDay() === 1 ? 3 : 1

  return {
    dateFrom: formatUtcAsYmd(anchor - back * MS_PER_DAY),
    dateTo: formatUtcAsYmd(anchor - MS_PER_DAY),
  }
}
