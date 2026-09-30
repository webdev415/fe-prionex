/**
 * Formatting helpers of the planner section (planner stories 1.10, 5.1).
 */
import type { useTranslation } from 'react-i18next'
import { intlLocaleForUiLanguage } from '@/lib/i18n'
import { formatNumber } from '@/lib/localeFormat'
import type { PlannerTaskCard } from '@/api/planner/plannerApi'

type Person = PlannerTaskCard['assignees'][number]
export type PlannerT = ReturnType<typeof useTranslation>['t']

/**
 * The board's zone when this browser can format in it, otherwise nothing: an
 * empty name, or a name the browser's ICU does not know («Europe/Kyiv» before
 * ICU 72), would make `Intl` fall back to the browser's own zone — and a
 * moment is said on the board's clock or not at all.
 */
export function usableTimeZone(tzid: string | null | undefined): string | undefined {
  if (!tzid) return undefined
  try {
    new Intl.DateTimeFormat('en', { timeZone: tzid })
    return tzid
  } catch {
    return undefined
  }
}

/** A calendar date `YYYY-MM-DD` is a date, not an instant: format it in UTC. */
export function formatDueDate(date: string, language: string): string {
  const parsed = new Date(`${date}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return date
  return new Intl.DateTimeFormat(intlLocaleForUiLanguage(language), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parsed)
}

/**
 * A span of working time the server measured (`sla_remaining_seconds`, an SLA
 * norm): minutes under an hour, hours under two days, days beyond — the
 * abbreviations need no plural forms (`5 год`, `2 дн`). Never below one unit:
 * a positive remainder does not read «0».
 *
 * `unit` is the unit of the norm the span is read against: next to «SLA 48 год»
 * the remainder stays in hours («залишилось 50 год», not «2 дн»); a norm in
 * days still shows a remainder under a day in hours or minutes.
 */
export function formatPlannerDuration(
  seconds: number,
  t: PlannerT,
  language: string,
  unit?: 'hours' | 'days'
): string {
  const value = (n: number) => formatNumber(Math.max(1, Math.floor(n)), language)
  if (seconds < 3600) return t('duration.minutes', { value: value(seconds / 60) })
  const daysFrom = unit === 'hours' ? Infinity : unit === 'days' ? 86_400 : 48 * 3600
  if (seconds < daysFrom) return t('duration.hours', { value: value(seconds / 3600) })
  return t('duration.days', { value: value(seconds / 86_400) })
}

/** A person without a name in the org mirror still needs a label. */
export function personName(person: Pick<Person, 'full_name' | 'crm_user_id'>): string {
  return person.full_name ?? `#${person.crm_user_id}`
}

/** Addresses of the section (UX «Инвентарь экранов»). */
export const PLANNER_ROOT_PATH = '/dashboard/planning'
export const PLANNER_TASKS_PATH = `${PLANNER_ROOT_PATH}/tasks`
export const PLANNER_CALENDAR_PATH = `${PLANNER_ROOT_PATH}/calendar`

export function boardPath(code: string): string {
  return `${PLANNER_TASKS_PATH}/boards/${encodeURIComponent(code)}`
}

/** Permanent link of a task (C-05, AD-35) — «Копіювати посилання». */
export function taskLinkPath(key: string): string {
  return `${PLANNER_ROOT_PATH}/t/${encodeURIComponent(key)}`
}
