/**
 * Small read-only pieces of a task: due pill and assignee names
 * (planner story 1.10). The due state comes from the server (`due_state`) —
 * the client never computes overdue itself.
 */
import { useTranslation } from 'react-i18next'
import { formatDateTime } from '@/lib/localeFormat'
import { cn } from '@/lib/utils'
import type { PlannerTaskCard } from '@/api/planner/plannerApi'
import { formatDueDate, personName } from '../plannerFormat'

type DueFields = Pick<PlannerTaskCard, 'due_date' | 'due_at' | 'due_state'>
type Person = PlannerTaskCard['assignees'][number]

export function DuePill({ task, className }: { task: DueFields; className?: string }) {
  const { t, i18n } = useTranslation('planner')
  const language = i18n.language ?? 'uk'
  const text = task.due_date
    ? formatDueDate(task.due_date, language)
    : task.due_at
      ? formatDateTime(task.due_at, language)
      : null
  if (!text)
    return <span className={cn('text-muted-foreground text-xs', className)}>{t('task.noDue')}</span>

  const state = task.due_state === 'overdue' || task.due_state === 'soon' ? task.due_state : null
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs',
        state === 'overdue' && 'border-error-500 text-error-500',
        state === 'soon' && 'border-warning-500 text-warning-500',
        !state && 'border-border text-muted-foreground',
        className
      )}
    >
      {state && <span>{t(`task.dueState.${state}`)} ·</span>}
      <span>{text}</span>
    </span>
  )
}

export function AssigneeNames({ people }: { people: Person[] }) {
  const { t } = useTranslation('planner')
  if (people.length === 0) {
    return <span className="text-muted-foreground text-xs">{t('task.noAssignees')}</span>
  }
  return (
    <span className="text-foreground text-xs">
      {people
        .map((person) =>
          person.inactive ? `${personName(person)} (${t('task.inactive')})` : personName(person)
        )
        .join(', ')}
    </span>
  )
}
