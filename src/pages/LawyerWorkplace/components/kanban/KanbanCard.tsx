import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import type { KanbanTask, KanbanTaskType } from '../../kanban/kanbanData'
import { formatKanbanMonthDay } from '../../utils/formatters'
import { ASSIGNEE_COLOURS, CREATE_TASK_PRIORITIES, CREATE_TASK_TYPES } from './constants'
import { KanbanAssigneeChip } from './KanbanAssigneeChip'
import { KanbanClientChip } from './KanbanClientChip'
import { KanbanPriorityIcon } from './KanbanPriorityOption'
import { KanbanTypeBadge } from './KanbanTypeBadge'

const ASSIGNEE_OPTIONS = [
  { initials: 'VD', name: 'Doroshenko' },
  { initials: 'LK', name: 'Kostenko' },
  { initials: 'SM', name: 'Melnychenko' },
  { initials: 'ON', name: 'manager' },
]

interface KanbanCardProps {
  task: KanbanTask
  onCardClick?: (letterId: string) => void
}

export function KanbanCard({ task, onCardClick }: KanbanCardProps) {
  const { t } = useTranslation('common')
  const isOverdue = task.columnId === 'overdue'
  const isCompleted = task.columnId === 'completed'
  const isNotDefined = task.columnId === 'not_defined'
  const priorityConfig = CREATE_TASK_PRIORITIES.find((item) => item.id === task.priority)

  const [assigneeInitials, setAssigneeInitials] = useState(task.assigneeInitials)
  const [assigneeName, setAssigneeName] = useState(task.assigneeName)
  const [taskType, setTaskType] = useState<KanbanTaskType>(task.type)

  const handleCardClick = () => {
    if (task.letterId) {
      onCardClick?.(task.letterId)
    }
  }

  return (
    <div
      role={task.letterId ? 'button' : undefined}
      tabIndex={task.letterId ? 0 : undefined}
      onClick={task.letterId ? handleCardClick : undefined}
      onKeyDown={
        task.letterId
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                handleCardClick()
              }
            }
          : undefined
      }
      className={cn(
        'rounded-lg bg-white p-3 shadow-[0_1px_2px_0_rgba(5,4,13,0.04)]',
        task.letterId ? 'cursor-pointer transition-shadow hover:shadow-md' : 'cursor-default',
        isOverdue ? 'border-error-400 border-l-2' : ''
      )}
    >
      {/* Row 1: type/overdue badge + task ID */}
      <div className="mb-2 flex items-center justify-between gap-2">
        {isOverdue ? (
          <span className="bg-error-50 text-error-600 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium">
            <Icons.Warning size={11} strokeWidth={2.5} className="shrink-0" />
            {t('pages.lawyerWorkplace.kanban.overdueBadge', 'Overdue')}
          </span>
        ) : isNotDefined ? (
          // Inline type editing for not_defined column
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                onClick={(e) => e.stopPropagation()}
                className="focus:outline-none"
              >
                <KanbanTypeBadge type={taskType} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="p-1.5">
              {CREATE_TASK_TYPES.map((type) => (
                <DropdownMenuItem
                  key={type}
                  className="cursor-pointer rounded-md px-2 py-1.5 focus:bg-gray-50"
                  onClick={(e) => {
                    e.stopPropagation()
                    setTaskType(type)
                  }}
                >
                  <KanbanTypeBadge type={type} />
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <KanbanTypeBadge type={taskType} />
        )}
        <span className="text-light-400 shrink-0 text-[10px] font-medium tracking-wide">
          {task.id}
        </span>
      </div>

      {/* Overdue: type badge on own row */}
      {isOverdue && (
        <div className="mb-2">
          <KanbanTypeBadge type={taskType} />
        </div>
      )}

      {/* Title */}
      <p className="text-dark-500 mb-1.5 text-[13px] leading-snug font-semibold">{task.title}</p>

      {/* Client */}
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

      {/* Footer: deadline + priority + assignee */}
      <div className="flex items-center justify-between gap-2">
        {isNotDefined ? (
          <span className="text-light-400 text-[11px]">
            {t('pages.lawyerWorkplace.kanban.noDeadline', 'no deadline set')}
          </span>
        ) : isOverdue && task.deadline ? (
          <span className="text-error-600 text-[11px] font-medium">
            {t('pages.lawyerWorkplace.kanban.dueLabel', 'due:')}{' '}
            {formatKanbanMonthDay(task.deadline)}
          </span>
        ) : isCompleted && task.closedAt ? (
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

          {/* Inline assignee dropdown */}
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                onClick={(e) => e.stopPropagation()}
                className="focus-visible:ring-primary-500 rounded focus:outline-none focus-visible:ring-2"
                title={t('pages.lawyerWorkplace.kanban.changeAssignee', 'Change assignee')}
              >
                <KanbanAssigneeChip initials={assigneeInitials} name={assigneeName} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[170px] p-1.5">
              {ASSIGNEE_OPTIONS.map((opt) => (
                <DropdownMenuItem
                  key={opt.initials}
                  className={cn(
                    'cursor-pointer rounded-md px-2 py-1.5 text-[12px] focus:bg-gray-50',
                    opt.initials === assigneeInitials && 'bg-gray-50'
                  )}
                  onClick={(e) => {
                    e.stopPropagation()
                    setAssigneeInitials(opt.initials)
                    setAssigneeName(opt.name)
                  }}
                >
                  <span className="flex items-center gap-2">
                    <span
                      className={cn(
                        'flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold',
                        ASSIGNEE_COLOURS[opt.initials] ?? 'bg-gray-100 text-gray-500'
                      )}
                    >
                      {opt.initials}
                    </span>
                    <span className="text-dark-500">{opt.name}</span>
                    {opt.initials === assigneeInitials && (
                      <Icons.Checkmark
                        size={12}
                        className="text-primary-600 ml-auto"
                        strokeWidth={2}
                      />
                    )}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  )
}
