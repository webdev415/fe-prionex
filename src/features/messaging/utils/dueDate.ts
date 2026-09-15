import { isRealCalendarDate } from '@/lib/calendarDate'
import { getDateStringInTimezone } from '@/lib/dateUtils'

const CARRIES_UTC_OFFSET = /(?:Z|[+-]\d{2}:?\d{2})$/i

function dayOfInstant(instant: Date, timezone?: string | null): string {
  return Number.isNaN(instant.getTime()) ? '' : getDateStringInTimezone(instant, timezone)
}

function dayAsWritten(value: string): string {
  const day = value.slice(0, 10)
  return isRealCalendarDate(day) ? day : ''
}

function promisedDay(value: string | null | undefined, timezone?: string | null): string {
  const text = (value ?? '').trim()
  return CARRIES_UTC_OFFSET.test(text) ? dayOfInstant(new Date(text), timezone) : dayAsWritten(text)
}

export function resolveDueDate(
  client: { max_promise_to_pay_date?: string | null } | null | undefined,
  timezone?: string | null
): string {
  if (!client) return ''
  const day =
    promisedDay(client.max_promise_to_pay_date, timezone) || dayOfInstant(new Date(), timezone)
  const [year, month, date] = day.split('-')
  return `${date}.${month}.${year}`
}
