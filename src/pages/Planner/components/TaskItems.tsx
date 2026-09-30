/**
 * Task row (lists) — planner stories 1.10 (AC4) and 5.1 (the shared pieces):
 * status chip, number, title, due and SLA pills, priority, origin and assignee
 * avatars; a click opens the task panel. The title is masked for session
 * recording (`piiProps`): analysts put debtor data into titles (UX «Карточка
 * задачи»). The kanban card is `board/KanbanCard` (5.3).
 */
import { useTranslation } from 'react-i18next'
import { piiProps } from '@/lib/openreplay/pii'
import type { PlannerTaskCard } from '@/api/planner/plannerApi'
import { StatusChip } from './StatusChip'
import { DuePill, SlaPill } from './TaskPills'
import { AvatarStack } from './PersonAvatar'
import { OriginChip } from './OriginChip'
import { PriorityIcon } from './PriorityIcon'

interface TaskItemProps {
  task: PlannerTaskCard
  onOpen: (key: string) => void
}

export function TaskRow({ task, onOpen }: TaskItemProps) {
  const { t } = useTranslation('planner')
  return (
    <li className="border-border flex flex-wrap items-center gap-3 border-b px-2 py-2 last:border-b-0">
      <StatusChip task={task} />
      <button
        type="button"
        className="flex min-w-0 flex-1 items-baseline gap-2 text-left"
        onClick={() => onOpen(task.key)}
        aria-label={t('panel.label', { key: task.key })}
      >
        <span className="text-muted-foreground shrink-0 font-mono text-xs tabular-nums">
          {task.key}
        </span>
        <span className="text-foreground truncate text-sm" {...piiProps}>
          {task.title}
        </span>
      </button>
      <DuePill task={task} />
      <SlaPill task={task} />
      <PriorityIcon task={task} />
      <OriginChip origin={task.origin} />
      <AvatarStack people={task.assignees} />
    </li>
  )
}
