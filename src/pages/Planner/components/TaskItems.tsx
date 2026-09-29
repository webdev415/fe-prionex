/**
 * Task card (board) and task row (lists) — planner story 1.10, AC1 and AC4.
 * The card shows number, title, assignees and due date; a click opens the
 * task panel. The title is masked for session recording (`piiProps`): analysts
 * put debtor data into titles (UX «Карточка задачи»).
 */
import { useTranslation } from 'react-i18next'
import { piiProps } from '@/lib/openreplay/pii'
import type { PlannerTaskCard } from '@/api/planner/plannerApi'
import { StatusChip } from './StatusChip'
import { AssigneeNames, DuePill } from './TaskMeta'

interface TaskItemProps {
  task: PlannerTaskCard
  onOpen: (key: string) => void
}

interface TaskCardViewProps extends TaskItemProps {
  /** The board's `tzid`, already at hand on the board screen. */
  timeZone?: string
}

export function TaskCardView({ task, onOpen, timeZone }: TaskCardViewProps) {
  return (
    <article className="border-border bg-card space-y-2 rounded-lg border p-3 shadow-sm">
      <button type="button" className="block w-full text-left" onClick={() => onOpen(task.key)}>
        <span className="text-muted-foreground block font-mono text-xs">{task.key}</span>
        <span className="text-foreground block text-sm font-medium break-words" {...piiProps}>
          {task.title}
        </span>
      </button>
      <AssigneeNames people={task.assignees} />
      <div className="flex flex-wrap items-center gap-2">
        <StatusChip task={task} />
        <DuePill task={task} timeZone={timeZone} />
      </div>
    </article>
  )
}

export function TaskRow({ task, onOpen }: TaskItemProps) {
  const { t } = useTranslation('planner')
  return (
    <li className="border-border flex flex-wrap items-center gap-3 border-b px-2 py-2 last:border-b-0">
      <button
        type="button"
        className="flex min-w-0 flex-1 items-baseline gap-2 text-left"
        onClick={() => onOpen(task.key)}
        aria-label={t('panel.label', { key: task.key })}
      >
        <span className="text-muted-foreground shrink-0 font-mono text-xs">{task.key}</span>
        <span className="text-foreground truncate text-sm" {...piiProps}>
          {task.title}
        </span>
      </button>
      <StatusChip task={task} />
      <AssigneeNames people={task.assignees} />
      <DuePill task={task} />
    </li>
  )
}
