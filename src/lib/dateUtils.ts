/**
 * Date utilities that respect the user's profile timezone (IANA format, e.g. "Europe/Kyiv").
 *
 * All "today / this week / this month" calculations must be done in the user's
 * profile timezone — NOT the browser's local timezone — so that dates sent to
 * the backend match what the user sees in the UI.
 *
 * DB stores datetimes in UTC. The backend SMS/call/report services query by date
 * in UTC (midnight-to-midnight). When we say "today" we must mean "today in the
 * user's configured timezone", otherwise a UTC+2 user sees yesterday's data.
 */

import type { Period } from '@/features/report/types'

// ---------------------------------------------------------------------------
// Core helper
// ---------------------------------------------------------------------------

/**
 * Format a UTC Date object as a "YYYY-MM-DD" string in the given IANA timezone.
 * Falls back to the browser's local date parts if the timezone is not provided
 * or the Intl API is unavailable.
 *
 * @param date      - The Date to format (defaults to now)
 * @param timezone  - IANA timezone string from user profile (e.g. "Europe/Kyiv")
 */
export function getDateStringInTimezone(date: Date = new Date(), timezone?: string | null): string {
  if (timezone) {
    try {
      // Intl.DateTimeFormat resolves the date parts in the requested timezone
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).formatToParts(date)

      // 'en-CA' locale produces "YYYY-MM-DD" ordering — we just join the parts
      const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
      return `${get('year')}-${get('month')}-${get('day')}`
    } catch {
      // Unknown/invalid timezone — fall through to local date
    }
  }

  // Fallback: use local date parts (still better than .toISOString() which is always UTC)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/**
 * Format a UTC Date object as a "YYYY-MM-DDTHH:mm" string in the given IANA timezone.
 * Used for datetime fields (Promise date, Callback date) that include time component.
 */
export function getDateTimeStringInTimezone(
  date: Date = new Date(),
  timezone?: string | null
): string {
  if (timezone) {
    try {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).formatToParts(date)

      const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00'
      return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`
    } catch {
      // Unknown/invalid timezone — fall through to local
    }
  }

  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/**
 * Treat a naive "YYYY-MM-DDTHH:mm" wall time as if it were in the given
 * timezone, and return the corresponding UTC ISO timestamp.
 *
 * Use when the user picked a wall time meaning "this time in my profile
 * timezone" (e.g. Kyiv) but the browser tz might differ from the profile
 * tz, so we can't rely on `new Date(naive).toISOString()`.
 */
export function wallTimeAsTimezoneToUtcIso(naive: string, timezone: string): string {
  const m = naive.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)
  if (!m) return naive
  const [, y, mo, d, h, mi] = m
  const wallUtcMs = Date.UTC(+y, +mo - 1, +d, +h, +mi)
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    const parts = fmt.formatToParts(new Date(wallUtcMs))
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? '0')
    const tzWallAsUtcMs = Date.UTC(
      get('year'),
      get('month') - 1,
      get('day'),
      get('hour'),
      get('minute')
    )
    const offsetMs = tzWallAsUtcMs - wallUtcMs
    return new Date(wallUtcMs - offsetMs).toISOString()
  } catch {
    return new Date(naive).toISOString()
  }
}

// ---------------------------------------------------------------------------
// Period range helper (used by dashboard, modals, and agent table)
// ---------------------------------------------------------------------------

export interface DateRange {
  from: string
  to: string
}

/**
 * Return a { from, to } date range (YYYY-MM-DD strings) for a given period,
 * calculated in the user's profile timezone.
 */
export function getDateRangeForPeriod(period: Period, timezone?: string | null): DateRange {
  const now = new Date()

  // "today" expressed as a plain date in the user's timezone
  const todayStr = getDateStringInTimezone(now, timezone)

  switch (period) {
    case 'today':
      return { from: todayStr, to: todayStr }

    case 'thisWeek': {
      // Determine day-of-week in the user's timezone using Intl
      let dayOfWeek: number
      try {
        if (timezone) {
          // weekday: 'long' gives the English name; we only need day-of-week index
          const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: timezone,
            weekday: 'short',
          })
          const day = formatter.format(now)
          const dayMap: Record<string, number> = {
            Sun: 0,
            Mon: 1,
            Tue: 2,
            Wed: 3,
            Thu: 4,
            Fri: 5,
            Sat: 6,
          }
          dayOfWeek = dayMap[day] ?? new Date().getDay()
        } else {
          dayOfWeek = now.getDay()
        }
      } catch {
        dayOfWeek = now.getDay()
      }

      // Monday = start of week
      const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1

      const mondayMs = now.getTime() - daysFromMonday * 24 * 60 * 60 * 1000
      const sundayMs = mondayMs + 6 * 24 * 60 * 60 * 1000

      return {
        from: getDateStringInTimezone(new Date(mondayMs), timezone),
        to: getDateStringInTimezone(new Date(sundayMs), timezone),
      }
    }

    case 'thisMonth': {
      // First and last day of the current month in the user's timezone
      // todayStr is "YYYY-MM-DD" in the user's tz
      const [year, month] = todayStr.split('-').map(Number)
      const firstDay = `${year}-${String(month).padStart(2, '0')}-01`

      // Last day: first day of NEXT month minus 1 day
      const nextMonthFirstMs = new Date(Date.UTC(year, month, 1)).getTime() // month is already 1-based
      const lastDayStr = getDateStringInTimezone(
        new Date(nextMonthFirstMs - 24 * 60 * 60 * 1000),
        timezone
      )

      return { from: firstDay, to: lastDayStr }
    }

    default:
      return { from: todayStr, to: todayStr }
  }
}
