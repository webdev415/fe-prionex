import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import type { KanbanTask } from '../../kanban/kanbanData'
import { formatKanbanMonthDay } from '../../utils/formatters'
import { KanbanAssigneeChip } from './KanbanAssigneeChip'
import { KanbanClientChip } from './KanbanClientChip'
import { KanbanPriorityIcon } from './KanbanPriorityOption'
import { KanbanTypeBadge } from './KanbanTypeBadge'
import { CREATE_TASK_PRIORITIES } from './constants'

interface KanbanCardProps {
  task: KanbanTask
}

export function KanbanCard({ task }: KanbanCardProps) {
  const { t } = useTranslation('common')
  const isOverdue = task.columnId === 'overdue'
  const isReady = task.columnId === 'ready'
  const isUnclassified = task.columnId === 'unclassified'
  const priorityConfig = CREATE_TASK_PRIORITIES.find((item) => item.id === task.priority)

  return (
    <div
      className={cn(
        'cursor-pointer rounded-lg bg-white p-3 shadow-[0_1px_2px_0_rgba(5,4,13,0.04)] transition-shadow hover:shadow-md',
        isOverdue ? 'border-error-100' : 'border-gray-100'
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        {isOverdue ? (
          <span className="bg-error-50 text-error-600 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium">
            <Icons.Warning size={11} strokeWidth={2.5} className="shrink-0" />
            {t('pages.lawyerWorkplace.kanban.overdueBadge', 'Overdue')}
          </span>
        ) : (
          <KanbanTypeBadge type={task.type} />
        )}
        <span className="text-light-400 shrink-0 text-[10px] font-medium tracking-wide">
          {task.id}
        </span>
      </div>

      {isOverdue && (
        <div className="mb-2">
          <KanbanTypeBadge type={task.type} />
        </div>
      )}

      <p className="text-dark-500 mb-1.5 text-[13px] leading-snug font-semibold">{task.title}</p>

      <div className="mb-3 flex min-w-0 items-center gap-1.5">
        {task.clientCode ? (
          <>
            <KanbanClientChip code={task.clientCode} />
            <span className="text-light-700 truncate text-[11px]">{task.clientName}</span>
          </>
        ) : (
          <span className="text-light-400 text-[11px] italic">
            {t('pages.lawyerWorkplace.letterItem.unidentified', 'unidentified')}
          </span>
        )}
      </div>
      <div className="mb-2 h-px w-full bg-gray-100" />

      <div className="flex items-center justify-between gap-2">
        {isUnclassified ? (
          <span className="text-light-400 text-[11px]">
            {t('pages.lawyerWorkplace.kanban.noDeadline', 'no deadline set')}
          </span>
        ) : isOverdue && task.deadline ? (
          <span className="text-error-600 text-[11px] font-medium">
            {t('pages.lawyerWorkplace.kanban.dueLabel', 'due:')}{' '}
            {formatKanbanMonthDay(task.deadline)}
          </span>
        ) : isReady && task.closedAt ? (
          <span className="text-light-500 text-[11px]">
            {t('pages.lawyerWorkplace.kanban.closedLabel', 'closed')}{' '}
            {formatKanbanMonthDay(task.closedAt)}
          </span>
        ) : task.deadline ? (
          <span className="text-light-600 text-[11px]">
            {t('pages.lawyerWorkplace.kanban.byLabel', 'by')} {formatKanbanMonthDay(task.deadline)}
          </span>
        ) : null}

        <div className="flex shrink-0 items-center gap-1.5">
          <span
            className="flex h-4 w-4 items-center justify-center"
            title={priorityConfig ? t(priorityConfig.key, priorityConfig.fallback) : undefined}
            aria-hidden="true"
          >
            <KanbanPriorityIcon priority={task.priority} />
          </span>
          <KanbanAssigneeChip initials={task.assigneeInitials} name={task.assigneeName} />
        </div>
      </div>
    </div>
  )
}
