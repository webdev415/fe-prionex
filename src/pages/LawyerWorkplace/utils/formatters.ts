import type { TFunction } from 'i18next'
import { formatDate, formatMonthDay } from '@/lib/localeFormat'
import {
  parseLegalDueDate,
  resolveLegalTimezone,
} from '@/features/lawyerWorkplace/utils/legalDueDate'

export function formatLetterTime(iso: string, t: TFunction, language: string): string {
  const d = new Date(iso)
  const hhmm = d.toLocaleTimeString(language, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const msgStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const diffDays = Math.round((todayStart - msgStart) / 86_400_000)

  if (diffDays === 0) return hhmm
  if (diffDays === 1) {
    return t('pages.lawyerWorkplace.dates.yesterdayTime', {
      time: hhmm,
      defaultValue: `Yesterday · ${hhmm}`,
    })
  }

  const datePart = d.toLocaleDateString(language, { month: 'short', day: 'numeric' })
  return `${datePart} · ${hhmm}`
}

export function formatDateSeparator(iso: string, language: string): string {
  const d = new Date(iso)
  const datePart = d.toLocaleDateString(language, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
  const weekday = d.toLocaleDateString(language, { weekday: 'long' })
  return `${datePart} · ${weekday}`
}

export function formatDueDate(iso: string, language: string): string {
  return new Date(iso).toLocaleString(language, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

/**
 * A legal deadline, on the profile clock, in `dd.MM.yyyy HH:mm` (KAN-1000).
 *
 * `formatDueDate` above gets both of its shapes wrong and stays put because it
 * also renders `receivedAt`, which belongs on the browser clock alongside the
 * rest of the thread timestamps.
 *
 * Deadlines arrive in two shapes and each fails its own way. Kanban due dates
 * are naive UTC, which `new Date` reads as local — the card said 06:00 while
 * the drawer beside it said 03:00. SLA due dates are date-only, which `new
 * Date` reads as UTC midnight and then renders with a fabricated local time,
 * dropping to the previous day anywhere west of UTC.
 */
export function formatLegalDeadline(
  iso: string,
  language: string,
  timezone?: string | null
): string {
  const trimmed = iso.trim()
  if (DATE_ONLY.test(trimmed)) {
    const [year, month, day] = trimmed.split('-').map(Number)
    return new Date(year, month - 1, day).toLocaleDateString(language, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }
  const parsed = parseLegalDueDate(trimmed)
  if (!parsed) return iso
  return parsed.toLocaleString(language, {
    timeZone: resolveLegalTimezone(timezone),
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

export function formatKanbanMonthDay(isoDate: string, language: string): string {
  return formatMonthDay(new Date(isoDate), language)
}

export function formatDocumentDateLines(
  iso: string,
  t: TFunction,
  language: string
): { dateLine: string; timeLine: string } {
  const d = new Date(iso)
  const timeLine = d.toLocaleTimeString(language, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const msgStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const diffDays = Math.round((todayStart - msgStart) / 86_400_000)

  let dateLine: string
  if (diffDays === 0) {
    dateLine = t('pages.lawyerWorkplace.documents.dates.today', 'today')
  } else if (diffDays === 1) {
    dateLine = t('pages.lawyerWorkplace.documents.dates.yesterday', 'yesterday')
  } else {
    dateLine = formatDate(d, language)
  }

  return { dateLine, timeLine }
}
