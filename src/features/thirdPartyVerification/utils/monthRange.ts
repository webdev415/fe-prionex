/**
 * Current-month window for the verification report's "sell" filter.
 *
 * The backend defaults `sell_from`/`sell_to` to the first and last day of the
 * current month in the requested timezone (UTC when none is sent). With a
 * profile timezone set the FE resolves the same window; without one it falls
 * back to the BROWSER timezone, which can differ from the backend's UTC around
 * midnight. Harmless either way: the tab always sends both dates explicitly,
 * so the backend default never applies.
 *
 * Why not `getDateRangeForPeriod('thisMonth', tz)`: that helper derives the
 * last day by re-formatting a UTC-midnight Date in the profile timezone,
 * which lands on the previous calendar day for zones behind UTC. Here the
 * month bounds are pure calendar arithmetic on the already-resolved "today in
 * the profile timezone" string, so no second timezone conversion can shift
 * them.
 */

import { getDateStringInTimezone } from '@/lib/dateUtils'

export interface MonthRange {
  /** First day of the month, YYYY-MM-DD. */
  from: string
  /** Last day of the month, YYYY-MM-DD. */
  to: string
}

const pad = (n: number) => String(n).padStart(2, '0')

/**
 * First and last calendar day of the month that contains "now" in the user's
 * profile timezone (browser-local when no timezone is set).
 */
export function currentMonthRange(timezone?: string | null, now: Date = new Date()): MonthRange {
  const today = getDateStringInTimezone(now, timezone)
  const [year, month] = today.split('-').map(Number)

  // Day 0 of the NEXT month is the last day of this one — handles 28/29/30/31
  // (including leap Februaries) without a table. Built in UTC so the host
  // timezone cannot roll it over.
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()

  return {
    from: `${year}-${pad(month)}-01`,
    to: `${year}-${pad(month)}-${pad(lastDay)}`,
  }
}
