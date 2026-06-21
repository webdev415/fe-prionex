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

import { format as formatFns, isValid as isValidFns, parse as parseFns } from 'date-fns'
import type { Period } from '@/features/report/types'

// ---------------------------------------------------------------------------
// Manual date/time entry (DD.MM.YYYY HH:MM)
// ---------------------------------------------------------------------------

/**
 * Display + manual-entry format for datetime fields that accept keyboard
 * input. Dots for the date, colon for the time, 24-hour, no seconds.
 */
export const DATETIME_DISPLAY_FORMAT = 'dd.MM.yyyy HH:mm'

/** Display + manual-entry format for date-only filter fields (no time). */
export const DATE_DISPLAY_FORMAT = 'dd.MM.yyyy'

// Per-segment rules for the smart mask, in field order: day, month, year,
// hour, minute. ``padGt`` is the classic datetime-mask shortcut — if the
// first digit can't possibly start a valid value (e.g. ``9`` for an hour,
// max 23), treat it as the second digit and prepend a ``0`` (``9`` → ``09``),
// auto-advancing to the next field. A completed two-digit value is clamped
// into ``[min, max]`` so impossible numbers can never be entered: ``35`` day
// → ``31``, ``00`` day → ``01``. Day/month start at 1; hour/minute start at 0
// (midnight is valid). The year is free-form (4 digits, no range).
const DATETIME_SEGMENTS: ReadonlyArray<{
  len: number
  padGt?: number
  min?: number
  max?: number
}> = [
  { len: 2, padGt: 3, min: 1, max: 31 }, // day
  { len: 2, padGt: 1, min: 1, max: 12 }, // month
  { len: 4 }, // year
  { len: 2, padGt: 2, min: 0, max: 23 }, // hour
  { len: 2, padGt: 5, min: 0, max: 59 }, // minute
]

/**
 * Reduce a raw digit stream to range-valid ``DDMMYYYYHHMM`` digits, applying
 * the per-segment pad/clamp rules above so the user can't even type an
 * impossible day/month/hour/minute. Partial input is preserved.
 */
function smartDateTimeDigits(raw: string): string {
  const input = raw.replace(/\D/g, '')
  let out = ''
  let i = 0
  for (const seg of DATETIME_SEGMENTS) {
    if (i >= input.length) break
    if (seg.padGt === undefined) {
      // Year — take up to its length, no clamping.
      const take = input.slice(i, i + seg.len)
      out += take
      i += take.length
      continue
    }
    const first = input[i]
    i += 1
    if (Number(first) > seg.padGt) {
      out += '0' + first // impossible as a first digit → pad + advance
      continue
    }
    if (i >= input.length) {
      out += first // only one digit typed so far
      break
    }
    const second = input[i]
    i += 1
    let val = Number(first) * 10 + Number(second)
    if (seg.max !== undefined && val > seg.max) val = seg.max
    if (seg.min !== undefined && val < seg.min) val = seg.min
    out += String(val).padStart(2, '0')
  }
  return out
}

/**
 * Auto-insert the ``DD.MM.YYYY HH:MM`` separators as the user types, while
 * live-blocking out-of-range values (hours ≤ 23, minutes ≤ 59, months ≤ 12,
 * days ≤ 31). Keeps only digits (so backspacing over a separator works),
 * then re-inserts ``.``/space/``:`` once the following group begins. Partial
 * input is preserved — typing ``1506`` yields ``15.06`` and ``9`` (an
 * impossible day start) yields ``09``.
 */
export function maskDateTimeInput(raw: string): string {
  const d = smartDateTimeDigits(raw)
  let out = d.slice(0, 2)
  if (d.length > 2) out += '.' + d.slice(2, 4)
  if (d.length > 4) out += '.' + d.slice(4, 8)
  if (d.length > 8) out += ' ' + d.slice(8, 10)
  if (d.length > 10) out += ':' + d.slice(10, 12)
  return out
}

/**
 * Decide the value to commit when a calendar selection is made, applying a
 * default time-of-day only when the user set the DATE first (KAN-578 case
 * split). The default seeds the time **only** when all hold:
 *   • a ``defaultTime`` is configured (e.g. "09:00"),
 *   • there is no committed value yet (first selection),
 *   • the selection came from a calendar **day** click (``fromDayClick``).
 * A time-first pick (``fromDayClick === false``) keeps the user's chosen time,
 * and any later selection (``hasExistingValue``) leaves the time untouched.
 */
export function applyDefaultTimeToDate(
  date: Date,
  opts: { defaultTime?: string; hasExistingValue: boolean; fromDayClick: boolean }
): Date {
  const { defaultTime, hasExistingValue, fromDayClick } = opts
  if (!defaultTime || hasExistingValue || !fromDayClick) return date
  const [h, m] = defaultTime.split(':').map(Number)
  const next = new Date(date)
  next.setHours(h || 0, m || 0, 0, 0)
  return next
}

/**
 * Strictly parse a ``DD.MM.YYYY HH:MM`` string. Returns a Date only when the
 * input is **complete** (all 12 digits) and **valid** — incomplete input
 * (date without time) and impossible values (``35.13.2026``, ``10.06.2026
 * 25:00``) return ``null`` so the caller can flag them. The round-trip
 * format check rejects any value date-fns would silently normalise.
 */
export function parseManualDateTime(masked: string): Date | null {
  const digits = masked.replace(/\D/g, '')
  if (digits.length !== 12) return null
  const parsed = parseFns(masked, DATETIME_DISPLAY_FORMAT, new Date())
  if (!isValidFns(parsed)) return null
  if (formatFns(parsed, DATETIME_DISPLAY_FORMAT) !== masked) return null
  return parsed
}

/**
 * Auto-insert ``DD.MM.YYYY`` separators as the user types. Reuses the same
 * day/month/year smart-mask rules as ``maskDateTimeInput`` (first 8 digits).
 */
export function maskDateInput(raw: string): string {
  const d = smartDateTimeDigits(raw).slice(0, 8)
  let out = d.slice(0, 2)
  if (d.length > 2) out += '.' + d.slice(2, 4)
  if (d.length > 4) out += '.' + d.slice(4, 8)
  return out
}

/**
 * Strictly parse a ``DD.MM.YYYY`` string. Returns a Date only when the input
 * is **complete** (8 digits) and **valid**.
 */
export function parseManualDate(masked: string): Date | null {
  const digits = masked.replace(/\D/g, '')
  if (digits.length !== 8) return null
  const parsed = parseFns(masked, DATE_DISPLAY_FORMAT, new Date())
  if (!isValidFns(parsed)) return null
  if (formatFns(parsed, DATE_DISPLAY_FORMAT) !== masked) return null
  return parsed
}

/**
 * Is the given naive wall-time value ("YYYY-MM-DDTHH:mm") — or an absolute
 * ISO string — strictly before "now"? Mirrors ``toUtcIsoIfDate`` so the
 * "date cannot be in the past" check is evaluated in the user's profile
 * timezone, not the browser's.
 */
export function isWallTimeInPast(value: string, timezone?: string | null): boolean {
  if (!value) return false
  let iso: string
  if (/[Zz]$|[+-]\d{2}:\d{2}$/.test(value)) {
    iso = value
  } else if (timezone) {
    iso = wallTimeAsTimezoneToUtcIso(value, timezone)
  } else {
    const d = new Date(value)
    if (isNaN(d.getTime())) return false
    iso = d.toISOString()
  }
  const t = new Date(iso).getTime()
  return !isNaN(t) && t < Date.now()
}

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
 * Format a ``react-datepicker`` Date as a plain "YYYY-MM-DD" string using its
 * **local** year/month/day parts — no timezone conversion.
 *
 * Use this for **date-only** filters where the user picks a calendar date
 * (no time component, no timezone meaning). ``react-datepicker`` returns a
 * Date at local-midnight for the picked day; reading ``getFullYear`` /
 * ``getMonth`` / ``getDate`` on it gives back exactly the day the user
 * clicked, regardless of any browser-vs-profile timezone mismatch.
 *
 * Do NOT use this for "now"-derived dates like `today` — those are real
 * moments in time and must be resolved in the user's profile timezone
 * (use ``getDateStringInTimezone`` instead).
 */
export function formatPickerDateAsYMD(date: Date): string {
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
