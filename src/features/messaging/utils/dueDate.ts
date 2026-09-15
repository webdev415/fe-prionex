import { isRealCalendarDate } from '@/lib/calendarDate'
import { getDateStringInTimezone } from '@/lib/dateUtils'

function toDotDMY(isoDate: string | null | undefined): string {
  const day = (isoDate ?? '').slice(0, 10)
  if (!isRealCalendarDate(day)) return ''
  const [year, month, date] = day.split('-')
  return `${date}.${month}.${year}`
}

export function resolveDueDate(
  client: { max_promise_to_pay_date?: string | null } | null | undefined,
  timezone?: string | null
): string {
  if (!client) return ''
  return (
    toDotDMY(client.max_promise_to_pay_date) ||
    toDotDMY(getDateStringInTimezone(new Date(), timezone))
  )
}
