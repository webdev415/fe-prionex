/**
 * Formatting helpers of the planner section (planner story 1.10).
 */
import { intlLocaleForUiLanguage } from '@/lib/i18n'
import type { PlannerTaskCard } from '@/api/planner/plannerApi'

type Person = PlannerTaskCard['assignees'][number]

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
