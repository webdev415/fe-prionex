/**
 * Legal task due dates are civil date+time in the user's profile timezone.
 * Picker local Y/M/D/H/M are treated as that profile-timezone wall clock.
 * DB storage remains UTC.
 */

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

export function parseLegalDueDate(iso: string | null | undefined): Date | null {
  if (!iso) return null
  const parsed = new Date(iso)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function formatLegalDueMonthDay(
  iso: string | null | undefined,
  timezone?: string | null
): string {
  const parsed = parseLegalDueDate(iso)
  if (!parsed) return ''
  const { month, day } = calendarPartsInTimezone(parsed, resolveLegalTimezone(timezone))
  return `${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}`
}

/** Profile-TZ month/day + HH:mm for kanban cards and detail panels. */
export function formatLegalDueDateTime(
  iso: string | null | undefined,
  timezone?: string | null
): string {
  const parsed = parseLegalDueDate(iso)
  if (!parsed) return ''
  const { month, day, hour, minute } = calendarPartsInTimezone(
    parsed,
    resolveLegalTimezone(timezone)
  )
  return `${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
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
