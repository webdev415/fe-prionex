/**
 * The «Внесені платежі» tab's DEFAULT window: the current month TO DATE.
 *
 * The same rule as the backend's own no-dates default
 * (`docs/recorded-payments-feed.md`: "omitting both = the current month in
 * `timezone`, the 1st .. today"). It is NOT the source system's window:
 * Techno-Finance's popup loads `[the 1st .. min(last day of the month,
 * yesterday in Kyiv)]` — it ends YESTERDAY; this tab and the backend end
 * TODAY. One day apart, deliberately: a report "to date" includes the
 * confirmations that landed today. Kept as a named function with a suite of
 * its own for the same reason the drains tab keeps `previousWorkingDayWindow`:
 * a `fallbackFrom: today` copied from a neighbouring tab would silently show
 * a single day instead of a month, and the page would look perfectly fine.
 *
 * The tab always SENDS the pair, so the server default never applies to its
 * requests. The two agree so that a request WITHOUT dates — a hand-built
 * URL, a client that is not this tab — opens on the same report this tab
 * opens on, rather than on a different one.
 *
 * Pure string arithmetic on the already-resolved "today in the profile zone":
 * the month is the first seven characters of `YYYY-MM-DD`, so no Date is
 * instantiated and no second timezone conversion can move the day.
 */

import { isRealCalendarDate } from '@/lib/calendarDate'

/** An inclusive `[dateFrom .. dateTo]` pair of YYYY-MM-DD calendar days. */
export interface RecordedPaymentsDefaultWindow {
  dateFrom: string
  dateTo: string
}

/**
 * The default window for a given «today».
 *
 * @param today today's calendar day (YYYY-MM-DD) in the operator's PROFILE
 *   timezone — `useTodayInTimezone`'s output, not the browser's day: near
 *   midnight on the 1st the browser and the profile can disagree about which
 *   MONTH it is, and the backend resolves its own default in the same zone.
 * @returns the inclusive window `[YYYY-MM-01 .. today]`, or `null` when
 *   `today` is not a usable calendar day — the honest answer rather than a
 *   silent today–today, which surfaces as a blocked request instead of a
 *   wrong window. Unreachable from the UI in practice.
 */
export function currentMonthToDateWindow(today: string): RecordedPaymentsDefaultWindow | null {
  if (!isRealCalendarDate(today)) return null
  return { dateFrom: `${today.slice(0, 7)}-01`, dateTo: today }
}
