/**
 * Legal task due dates represent a calendar day in the user's local timezone.
 * Serialize at local noon so UTC ISO strings do not shift the calendar day.
 */

export function legalDueDateToIso(date: Date): string {
  const next = new Date(date)
  next.setHours(12, 0, 0, 0)
  return next.toISOString()
}

export function parseLegalDueDate(iso: string | null | undefined): Date | null {
  if (!iso) return null
  const parsed = new Date(iso)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function formatLegalDueMonthDay(iso: string | null | undefined): string {
  const parsed = parseLegalDueDate(iso)
  if (!parsed) return ''
  const mm = String(parsed.getMonth() + 1).padStart(2, '0')
  const dd = String(parsed.getDate()).padStart(2, '0')
  return `${mm}/${dd}`
}

/** Yesterday at local noon — used when moving a card to the overdue column. */
export function legalOverdueDueDateIso(): string {
  const date = new Date()
  date.setDate(date.getDate() - 1)
  date.setHours(12, 0, 0, 0)
  return date.toISOString()
}

const KYIV_TIME_ZONE = 'Europe/Kyiv'

function kyivCalendarDateKey(value: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: KYIV_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value)
}

/** True when the due calendar day (Europe/Kyiv) is strictly before today (Kyiv). */
export function isLegalDueDateOverdue(deadlineIso: string | null | undefined): boolean {
  const due = parseLegalDueDate(deadlineIso)
  if (!due) return false
  return kyivCalendarDateKey(new Date()) > kyivCalendarDateKey(due)
}
