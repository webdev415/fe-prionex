import { getDateStringInTimezone } from '@/lib/dateUtils'

function toDotDMY(isoDate: string | null | undefined): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate ?? '')
  return match ? `${match[3]}.${match[2]}.${match[1]}` : ''
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
