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

const KYIV_TIME_ZONE = 'Europe/Kyiv'

function kyivCalendarParts(reference = new Date()): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: KYIV_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(reference)

  const year = Number(parts.find((part) => part.type === 'year')?.value)
  const month = Number(parts.find((part) => part.type === 'month')?.value)
  const day = Number(parts.find((part) => part.type === 'day')?.value)
  return { year, month, day }
}

function kyivNoonUtcIsoForOffset(offsetDays: number): string {
  const { year, month, day } = kyivCalendarParts(new Date())
  return new Date(Date.UTC(year, month - 1, day + offsetDays, 12, 0, 0, 0)).toISOString()
}

/** Tomorrow (Kyiv calendar day) at UTC noon — moving a card out of overdue. */
export function legalDefaultDueDateIso(): string {
  return kyivNoonUtcIsoForOffset(1)
}

/** Yesterday (Kyiv calendar day) at UTC noon — moving a card to overdue. */
export function legalOverdueDueDateIso(): string {
  return kyivNoonUtcIsoForOffset(-1)
}

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
