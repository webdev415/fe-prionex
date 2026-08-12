/**
 * Legal task due dates are civil date+time in the user's profile timezone.
 * Picker local Y/M/D/H/M are treated as that profile-timezone wall clock.
 * DB storage remains UTC.
 */

import { formatMonthDay, formatTimeShort } from '@/lib/localeFormat'

export const LEGAL_DEFAULT_TIMEZONE = 'Europe/Kyiv'

export function resolveLegalTimezone(timezone?: string | null): string {
  const candidate = timezone?.trim()
  if (!candidate) return LEGAL_DEFAULT_TIMEZONE
  try {
    Intl.DateTimeFormat('en-US', { timeZone: candidate }).format(new Date())
    return candidate
  } catch {
    return LEGAL_DEFAULT_TIMEZONE
  }
}

function calendarPartsInTimezone(
  reference: Date,
  timezone: string
): { year: number; month: number; day: number; hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: resolveLegalTimezone(timezone),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(reference)

  const hourRaw = Number(parts.find((part) => part.type === 'hour')?.value)
  return {
    year: Number(parts.find((part) => part.type === 'year')?.value),
    month: Number(parts.find((part) => part.type === 'month')?.value),
    day: Number(parts.find((part) => part.type === 'day')?.value),
    // Some engines report midnight as 24
    hour: hourRaw === 24 ? 0 : hourRaw,
    minute: Number(parts.find((part) => part.type === 'minute')?.value),
  }
}

function calendarDateKey(value: Date, timezone: string): string {
  const { year, month, day } = calendarPartsInTimezone(value, timezone)
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/**
 * UTC instant for civil `year-month-day hour:minute` in `timezone`.
 * Uses an offset-correction loop (handles DST).
 */
function zonedCivilToUtcIso(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timezone: string
): string {
  const tz = resolveLegalTimezone(timezone)
  let utcMs = Date.UTC(year, month - 1, day, hour, minute, 0, 0)

  for (let i = 0; i < 3; i += 1) {
    const wall = calendarPartsInTimezone(new Date(utcMs), tz)
    const asIfUtc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, 0, 0)
    const wanted = Date.UTC(year, month - 1, day, hour, minute, 0, 0)
    const delta = wanted - asIfUtc
    utcMs += delta
    if (delta === 0) break
  }

  return new Date(utcMs).toISOString()
}

/**
 * Encode a picked date+time as UTC ISO in the profile timezone.
 * Uses the Date object's local Y/M/D/H/M as the intended civil wall clock
 * (DatePicker yields local calendar components).
 */
export function legalDueDateToIso(date: Date, timezone?: string | null): string {
  return zonedCivilToUtcIso(
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate(),
    date.getHours(),
    date.getMinutes(),
    resolveLegalTimezone(timezone)
  )
}

const HAS_TIME_PART = /\d{2}:\d{2}/
const HAS_TIMEZONE_PART = /(?:Z|[+-]\d{2}:?\d{2})$/i

/**
 * The task service stores `due_date` in a naive `DateTime` column and serialises
 * it with `.isoformat()`, so the wire value is UTC with no designator on it —
 * `2026-08-14T03:00:00`. `new Date` reads a date-time form without an offset as
 * *local* time (ECMA-262), which turned a Kyiv 06:00 deadline into a 03:00 one
 * on the card: the stored instant was right all along, the read lost the marker
 * (KAN-1000).
 *
 * Only offset-less date-times are stamped. Anything already carrying `Z` or
 * `+00:00` is left alone, which matters because the email service's
 * `suggested_due_date` sits in a `DateTime(timezone=True)` column and does send
 * one — stamping that a second time would shift it the other way. Date-only
 * values are left alone too; `new Date` already reads those as UTC.
 */
export function parseLegalDueDate(iso: string | null | undefined): Date | null {
  if (!iso) return null
  const trimmed = iso.trim()
  if (!trimmed) return null
  const normalized =
    HAS_TIME_PART.test(trimmed) && !HAS_TIMEZONE_PART.test(trimmed) ? `${trimmed}Z` : trimmed
  const parsed = new Date(normalized)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function formatLegalDueMonthDay(
  iso: string | null | undefined,
  timezone?: string | null,
  language?: string
): string {
  const parsed = parseLegalDueDate(iso)
  if (!parsed) return ''
  const { year, month, day } = calendarPartsInTimezone(parsed, resolveLegalTimezone(timezone))
  // Reconstruct the profile-TZ wall-clock day as a local Date so Intl reorders
  // month/day by locale (en → MM/DD, uk → DD.MM) without a browser-TZ shift.
  return formatMonthDay(new Date(year, month - 1, day), language ?? '')
}

/**
 * Read counterpart of ``legalDueDateToIso``: the stored instant as a Date whose
 * *local* Y/M/D/H/M carry the profile-timezone wall clock.
 *
 * Date pickers render a Date in browser-local time and have no timezone input,
 * so handing them the raw instant shows the deadline on the wrong clock — a
 * Kyiv 15:15 deadline reads 20:15 to someone working from UTC+8. The write side
 * already reinterprets picker-local components as profile wall clock; this is
 * the mirror of that, so the value a picker shows is the value it would send
 * back unchanged (KAN-1000).
 *
 * The result is only good for display and for picker round-trips. It is a
 * different instant from the one stored, so never send it anywhere or compare
 * it against a real timestamp.
 */
export function legalDueDateToPickerDate(
  iso: string | null | undefined,
  timezone?: string | null
): Date | null {
  const parsed = parseLegalDueDate(iso)
  if (!parsed) return null
  const { year, month, day, hour, minute } = calendarPartsInTimezone(
    parsed,
    resolveLegalTimezone(timezone)
  )
  return new Date(year, month - 1, day, hour, minute)
}

/** Profile-TZ month/day + HH:mm for kanban cards and detail panels. */
export function formatLegalDueDateTime(
  iso: string | null | undefined,
  timezone?: string | null,
  language?: string
): string {
  const local = legalDueDateToPickerDate(iso, timezone)
  if (!local) return ''
  return `${formatMonthDay(local, language ?? '')} ${formatTimeShort(local, language ?? '')}`
}

function noonUtcIsoForOffset(offsetDays: number, timezone?: string | null): string {
  const tz = resolveLegalTimezone(timezone)
  const today = calendarPartsInTimezone(new Date(), tz)
  const shifted = new Date(
    Date.UTC(today.year, today.month - 1, today.day + offsetDays, 12, 0, 0, 0)
  )
  return zonedCivilToUtcIso(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth() + 1,
    shifted.getUTCDate(),
    12,
    0,
    tz
  )
}

/** Tomorrow (profile calendar day) at noon in profile TZ — moving a card out of overdue. */
export function legalDefaultDueDateIso(timezone?: string | null): string {
  return noonUtcIsoForOffset(1, timezone)
}

/** Yesterday (profile calendar day) at noon in profile TZ — moving a card to overdue. */
export function legalOverdueDueDateIso(timezone?: string | null): string {
  return noonUtcIsoForOffset(-1, timezone)
}

/** True when the due calendar day (profile TZ) is strictly before today (profile TZ). */
export function isLegalDueDateOverdue(
  deadlineIso: string | null | undefined,
  timezone?: string | null
): boolean {
  const due = parseLegalDueDate(deadlineIso)
  if (!due) return false
  const tz = resolveLegalTimezone(timezone)
  return calendarDateKey(new Date(), tz) > calendarDateKey(due, tz)
}
