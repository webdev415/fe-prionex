import { type DragEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import type { LegalKanbanTaskPatch, LegalLawyer, LegalLetterType } from '@/features/lawyerWorkplace'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import type { KanbanColumnId, KanbanTask } from '../../kanban/kanbanData'
import {
  formatLegalDueDateTime,
  formatLegalDueMonthDay,
  legalDueDateToPickerDate,
} from '@/features/lawyerWorkplace/utils/legalDueDate'
import { CREATE_TASK_PRIORITIES, resolveKanbanTypeBadgeProps } from './constants'
import { KanbanAssigneeChip } from './KanbanAssigneeChip'
import { KanbanClientChip } from './KanbanClientChip'
import { KanbanPriorityIcon } from './KanbanPriorityOption'
import { KanbanTaskActionsMenuItems, buildKanbanAssigneeOptions } from './KanbanTaskEditMenus'
import { KanbanTypeBadge } from './KanbanTypeBadge'
import { piiProps } from '@/lib/openreplay/pii'

interface KanbanCardProps {
  task: KanbanTask
  lawyers: LegalLawyer[]
  /** All letter types for badge label/color resolution. */
  letterTypes: LegalLetterType[]
  /** Active letter types shown in the change-type menu. */
  editableLetterTypes: LegalLetterType[]
  timezone?: string | null
  isDragging?: boolean
  onCardClick?: (task: KanbanTask) => void
  onMoveTask?: (taskId: string, columnId: KanbanColumnId) => void
  onTaskUpdate?: (taskId: string, patch: LegalKanbanTaskPatch) => void
  onDragStart?: (event: DragEvent, task: KanbanTask) => void
  onDragEnd?: () => void
}

export function KanbanCard({
  task,
  lawyers,
  letterTypes,
  editableLetterTypes,
  timezone,
  isDragging = false,
  onCardClick,
  onMoveTask,
  onTaskUpdate,
  onDragStart,
  onDragEnd,
}: KanbanCardProps) {
  const { t, i18n } = useTranslation('common')
  const isOverdue = task.columnId === 'overdue'
  const isCompleted = task.columnId === 'completed'
  const typeBadge = resolveKanbanTypeBadgeProps(task.letterTypeId, letterTypes, task.type)
  const clientCode = task.clientCode ?? null
  const clientName = task.clientName?.trim() || null

  const deadline = legalDueDateToPickerDate(task.deadline, timezone)

  const assigneeInitials = task.assigneeInitials
  const assigneeName = task.assigneeName
  const priorityConfig =
    CREATE_TASK_PRIORITIES.find((item) => item.id === task.priority) ??
    CREATE_TASK_PRIORITIES.find((item) => item.id === 'medium')

  const assigneeOptions = buildKanbanAssigneeOptions(lawyers, task.assigneeUserId)

  const getAssigneeLabel = (initials: string, fallbackName: string) => {
    const option = assigneeOptions.find((item) => item.initials === initials)
    return option?.label ?? fallbackName
  }

  const isClickable = !isCompleted

  const handleCardClick = () => {
    if (isClickable) {
      onCardClick?.(task)
    }
  }

  const handleCardDragStart = (event: DragEvent) => {
    if (isCompleted) {
      event.preventDefault()
      return
    }
    const target = event.target as HTMLElement
    if (
      target.closest('button, input, textarea, [role="combobox"], a, [data-radix-collection-item]')
    ) {
      event.preventDefault()
      return
    }
    onDragStart?.(event, task)
  }

  return (
    <div
      data-kanban-task-id={task.taskId}
      draggable={!isCompleted}
      onDragStart={handleCardDragStart}
      onDragEnd={onDragEnd}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onClick={isClickable ? handleCardClick : undefined}
      onKeyDown={
        isClickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                handleCardClick()
              }
            }
          : undefined
      }
      className={cn(
        'bg-card relative rounded-lg p-3 shadow-[0_1px_2px_0_rgba(5,4,13,0.04)]',
        isClickable ? 'cursor-pointer transition-shadow hover:shadow-md' : 'cursor-default',
        !isCompleted && 'cursor-grab active:cursor-grabbing',
        isCompleted ? 'opacity-75' : '',
        isDragging && 'opacity-40'
      )}
    >
      {/* Row 1: type/overdue badge + task ID */}
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          {isOverdue ? (
            <span className="bg-error-50 text-error-600 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium">
              <Icons.Warning size={11} strokeWidth={2.5} className="shrink-0" />
              {t('pages.lawyerWorkplace.kanban.overdueBadge', 'Overdue')}
            </span>
          ) : (
            <KanbanTypeBadge
              type={typeBadge.type}
              label={typeBadge.label}
              colorId={typeBadge.colorId}
            />
          )}
          {task.letterCount > 1 && (
            <span
              className="bg-muted text-muted-foreground inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
              title={t('pages.lawyerWorkplace.kanban.lettersCount', {
                count: task.letterCount,
                defaultValue: '{{count}} letters',
              })}
            >
              <Icons.Mail size={10} strokeWidth={2} className="shrink-0" />
              {t('pages.lawyerWorkplace.kanban.lettersCount', {
                count: task.letterCount,
                defaultValue: '{{count}} letters',
              })}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {!isCompleted && (
            <span
              aria-hidden="true"
              className="text-muted-foreground flex h-8 w-8 items-center justify-center sm:h-5 sm:w-4"
            >
              <svg width="8" height="12" viewBox="0 0 8 12" fill="currentColor" aria-hidden="true">
                <circle cx="2" cy="2" r="1.2" />
                <circle cx="6" cy="2" r="1.2" />
                <circle cx="2" cy="6" r="1.2" />
                <circle cx="6" cy="6" r="1.2" />
                <circle cx="2" cy="10" r="1.2" />
                <circle cx="6" cy="10" r="1.2" />
              </svg>
            </span>
          )}
          <span
            className="flex h-4 w-4 shrink-0 items-center justify-center"
            title={t(priorityConfig?.key ?? '', priorityConfig?.fallback ?? 'Normal')}
          >
            <KanbanPriorityIcon priority={task.priority} />
          </span>
          <span className="text-muted-foreground text-[10px] font-medium tracking-wide">
            {task.id}
          </span>
        </div>
      </div>

      {/* Overdue: type badge on own row */}
      {isOverdue && (
        <div className="mb-2">
          <KanbanTypeBadge
            type={typeBadge.type}
            label={typeBadge.label}
            colorId={typeBadge.colorId}
          />
        </div>
      )}

      {/* Title */}
      <p className="text-foreground mb-1.5 text-[13px] leading-snug font-semibold">{task.title}</p>

      {/* Client */}
      <div className="mb-3 flex min-w-0 items-center gap-1.5">
        {clientCode ? (
          task.clientId ? (
            <Link
              to={`/dashboard/clients/${task.clientId}`}
              onClick={(e) => e.stopPropagation()}
              className="flex min-w-0 items-center gap-1.5 hover:underline"
              title={t('pages.lawyerWorkplace.openClientCard', 'Open client card')}
            >
              <KanbanClientChip code={clientCode} />
              {clientName ? (
                <span className="text-muted-foreground min-w-0 truncate text-[11px]" {...piiProps}>
                  {clientName}
                </span>
              ) : null}
            </Link>
          ) : (
            <>
              <KanbanClientChip code={clientCode} />
              {clientName ? (
                <span className="text-muted-foreground min-w-0 truncate text-[11px]" {...piiProps}>
                  {clientName}
                </span>
              ) : null}
            </>
          )
        ) : (
          <span className="text-muted-foreground text-[11px]">—</span>
        )}
      </div>

      <div className="bg-muted mb-2 h-px w-full" />

      {/* Footer: deadline + assignee */}
      <div className="flex items-center justify-between gap-2">
        {isCompleted ? (
          /* Completed: closed date is static, no editing */
          task.closedAt ? (
            <span className="text-muted-foreground text-[11px]">
              {t('pages.lawyerWorkplace.kanban.closedLabel', 'closed')}{' '}
              {formatLegalDueMonthDay(task.closedAt, timezone, i18n.language)}
            </span>
          ) : null
        ) : (
          /* Active columns: date display (editing via "..." menu) */
          <>
            {deadline ? (
              isOverdue ? (
                <span className="text-error-600 flex items-center gap-1 text-[11px] font-medium">
                  <Icons.Calendar size={11} strokeWidth={1.5} className="shrink-0" />
                  {t('pages.lawyerWorkplace.kanban.dueLabel', 'due:')}{' '}
                  {formatLegalDueDateTime(task.deadline, timezone, i18n.language)}
                </span>
              ) : (
                <span className="text-muted-foreground flex items-center gap-1 text-[11px]">
                  <Icons.Calendar size={11} strokeWidth={1.5} className="shrink-0" />
                  {t('pages.lawyerWorkplace.kanban.byLabel', 'by')}{' '}
                  {formatLegalDueDateTime(task.deadline, timezone, i18n.language)}
                </span>
              )
            ) : (
              <span className="text-muted-foreground flex items-center gap-1 text-[11px] italic">
                <Icons.Calendar size={11} strokeWidth={1.5} className="shrink-0" />
                {t('pages.lawyerWorkplace.kanban.noDeadline', 'no deadline set')}
              </span>
            )}
          </>
        )}

        <div className="flex shrink-0 items-center gap-1.5">
          {/* More options "..." — only for active columns */}
          {!isCompleted && (
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => e.stopPropagation()}
                  className="text-muted-foreground hover:text-foreground focus-visible:ring-primary-500 hover:bg-muted flex h-8 w-8 items-center justify-center rounded focus:outline-none focus-visible:ring-2 sm:h-5 sm:w-5"
                  title={t('pages.lawyerWorkplace.kanban.moreOptions', 'More options')}
                >
                  {/* Three-dot icon (not in icon set, rendered inline) */}
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 14 14"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <circle cx="2" cy="7" r="1.4" />
                    <circle cx="7" cy="7" r="1.4" />
                    <circle cx="12" cy="7" r="1.4" />
                  </svg>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="min-w-[190px] p-1.5"
                onClick={(e) => e.stopPropagation()}
              >
                <KanbanTaskActionsMenuItems
                  task={task}
                  lawyers={lawyers}
                  editableLetterTypes={editableLetterTypes}
                  timezone={timezone}
                  onMoveTask={onMoveTask}
                  onTaskUpdate={onTaskUpdate}
                />
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Assignee: always static — edit via "..." menu */}
          <KanbanAssigneeChip
            initials={assigneeInitials}
            name={getAssigneeLabel(assigneeInitials, assigneeName)}
            assigneeUserId={task.assigneeUserId}
          />
        </div>
      </div>
    </div>
  )
}
