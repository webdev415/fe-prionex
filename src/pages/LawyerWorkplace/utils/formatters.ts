import type { TFunction } from 'i18next'

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
  return new Date(iso).toLocaleDateString(language, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function formatKanbanMonthDay(isoDate: string): string {
  const d = new Date(isoDate)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${mm}/${dd}`
}
