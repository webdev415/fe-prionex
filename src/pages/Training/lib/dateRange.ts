import { getDateStringInTimezone } from '@/lib/dateUtils'

/** Build API datetime bounds from YYYY-MM-DD strings (interpreted in browser local TZ). */
export function localDateStringsToIsoRange(
  fromDate: string,
  toDate: string
): { from_datetime: string; to_datetime: string } {
  const from = new Date(`${fromDate}T00:00:00`)
  const to = new Date(`${toDate}T23:59:59.999`)
  return { from_datetime: from.toISOString(), to_datetime: to.toISOString() }
}

/** Default custom range: last 7 calendar days ending today, in the user's profile timezone. */
export function defaultCustomDateRange(tz: string | null | undefined): {
  from: string
  to: string
} {
  const now = new Date()
  const toStr = getDateStringInTimezone(now, tz)
  const start = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000)
  const fromStr = getDateStringInTimezone(start, tz)
  return { from: fromStr, to: toStr }
}
