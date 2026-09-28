/**
 * Small read-only pieces of a task: due pill and assignee names
 * (planner story 1.10). The due state comes from the server (`due_state`) —
 * the client never computes overdue itself.
 */
import { useTranslation } from 'react-i18next'
import { formatDateTime } from '@/lib/localeFormat'
import { piiProps } from '@/lib/openreplay/pii'
import { cn } from '@/lib/utils'
import { usePlannerBoard } from '@/api/planner/plannerQueries'
import type { PlannerTaskCard } from '@/api/planner/plannerApi'
import { formatDueDate, personName } from '../plannerFormat'

type DueFields = Pick<PlannerTaskCard, 'due_date' | 'due_at' | 'due_state'> & {
  board?: Pick<PlannerTaskCard['board'], 'code'>
}
type Person = PlannerTaskCard['assignees'][number]

interface DuePillProps {
  task: DueFields
  /**
   * The board's IANA zone (`Board.tzid`). A due MOMENT is shown on the board's
   * clock, not the browser's — a Kyiv board's 18:00 deadline reads 18:00 for a
   * manager travelling abroad too. When the caller does not know it, the pill
   * reads it from the task's board (the same cached `GET /boards/{code}` the
   * status chip uses); only a `due_at` needs it, a date has no time of day.
   */
  timeZone?: string
  className?: string
}

export function DuePill({ task, timeZone, className }: DuePillProps) {
  const { t, i18n } = useTranslation('planner')
  const language = i18n.language ?? 'uk'
  const needsZone = !task.due_date && Boolean(task.due_at) && !timeZone
  const board = usePlannerBoard(task.board?.code, needsZone, { poll: false })
  const zone = timeZone ?? board.data?.tzid
  const text = task.due_date
    ? formatDueDate(task.due_date, language)
    : task.due_at
      ? formatDateTime(task.due_at, language, zone)
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
  // Both branches are masked for session recording: the names are personal
  // data, and the empty branch shares the element so markup never depends on
  // which branch rendered.
  if (people.length === 0) {
    return (
      <span className="text-muted-foreground text-xs" {...piiProps}>
        {t('task.noAssignees')}
      </span>
    )
  }
  return (
    <span className="text-foreground text-xs" {...piiProps}>
      {people
        .map((person) =>
          person.inactive ? `${personName(person)} (${t('task.inactive')})` : personName(person)
        )
        .join(', ')}
    </span>
  )
}
