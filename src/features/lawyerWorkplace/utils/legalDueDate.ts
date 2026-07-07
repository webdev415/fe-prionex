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
