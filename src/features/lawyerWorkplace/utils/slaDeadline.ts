import type { SlaDayType } from '@/pages/LawyerWorkplace/settings/types'

/**
 * Add an SLA duration to a base date.
 *   - `'calendar'` → plain calendar days.
 *   - `'working'`  → business days only, skipping Saturdays and Sundays.
 *
 * The base day is the anchor and never counts; each added day moves forward
 * one calendar day, and for `'working'` only Mon–Fri decrement the remaining
 * count. E.g. Friday + 2 working days → Tuesday (Sat/Sun skipped). The
 * base date's time-of-day is preserved.
 *
 * Non-positive / non-finite `slaDays` returns a copy of the base unchanged.
 */
export function addSlaDays(base: Date, slaDays: number, dayType: SlaDayType): Date {
  const result = new Date(base)
  if (!Number.isFinite(slaDays) || slaDays <= 0) {
    return result
  }
  if (dayType === 'calendar') {
    result.setDate(result.getDate() + slaDays)
    return result
  }
  let remaining = slaDays
  while (remaining > 0) {
    result.setDate(result.getDate() + 1)
    const dayOfWeek = result.getDay() // 0 = Sunday, 6 = Saturday
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      remaining -= 1
    }
  }
  return result
}
