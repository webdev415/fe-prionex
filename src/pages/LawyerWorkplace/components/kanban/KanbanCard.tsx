import { type DragEvent } from 'react'
import { useTranslation } from 'react-i18next'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import type { LegalKanbanTaskPatch, LegalLawyer, LegalLetterType } from '@/features/lawyerWorkplace'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import type { KanbanColumnId, KanbanTask } from '../../kanban/kanbanData'
import {
  formatLegalDueMonthDay,
  legalDueDateToIso,
  parseLegalDueDate,
} from '@/features/lawyerWorkplace/utils/legalDueDate'
import {
  getAssigneeColour,
  KANBAN_COLUMN_MOVE_OPTIONS,
  resolveKanbanTypeBadgeProps,
} from './constants'
import { KanbanAssigneeChip } from './KanbanAssigneeChip'
import { KanbanClientChip } from './KanbanClientChip'
import { KanbanTypeBadge } from './KanbanTypeBadge'

const COLUMN_MOVE_OPTIONS = KANBAN_COLUMN_MOVE_OPTIONS

function renderLetterTypeOption(letterType: LegalLetterType) {
  const badge = resolveKanbanTypeBadgeProps(letterType.id, [letterType], 'type_pending')
  return <KanbanTypeBadge type={badge.type} label={badge.label} colorId={badge.colorId} />
}

interface KanbanCardProps {
  task: KanbanTask
  lawyers: LegalLawyer[]
  /** All letter types for badge label/color resolution. */
  letterTypes: LegalLetterType[]
  /** Active letter types shown in the change-type menu. */
  editableLetterTypes: LegalLetterType[]
  isDragging?: boolean
  onCardClick?: (task: KanbanTask) => void
  onMoveTask?: (taskId: string, columnId: KanbanColumnId) => void
  onTaskUpdate?: (taskId: string, patch: LegalKanbanTaskPatch) => void
  onDragStart?: (event: DragEvent, task: KanbanTask) => void
  onDragEnd?: () => void
}

function extractAssigneeName(displayName: string): string {
  const parts = displayName.trim().split(/\s+/)
  return parts[parts.length - 1] ?? displayName
}

export function KanbanCard({
  task,
  lawyers,
  letterTypes,
  editableLetterTypes,
  isDragging = false,
  onCardClick,
  onMoveTask,
  onTaskUpdate,
  onDragStart,
  onDragEnd,
}: KanbanCardProps) {
  const { t } = useTranslation('common')
  const isOverdue = task.columnId === 'overdue'
  const isCompleted = task.columnId === 'completed'
  const typeBadge = resolveKanbanTypeBadgeProps(task.letterTypeId, letterTypes, task.type)
  const clientCode = task.clientCode ?? null
  const clientName = task.clientName?.trim() || null

  const deadline = parseLegalDueDate(task.deadline)
  const assigneeInitials = task.assigneeInitials
  const assigneeName = task.assigneeName

  const assigneeOptions = lawyers.map((lawyer) => ({
    userId: lawyer.user_id,
    initials: lawyer.initials,
    name: extractAssigneeName(lawyer.display_name),
    label: lawyer.display_name,
  }))

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
        'relative rounded-lg bg-white p-3 shadow-[0_1px_2px_0_rgba(5,4,13,0.04)]',
        isClickable ? 'cursor-pointer transition-shadow hover:shadow-md' : 'cursor-default',
        !isCompleted && 'cursor-grab active:cursor-grabbing',
        isCompleted ? 'opacity-75' : '',
        isDragging && 'opacity-40'
      )}
    >
      {/* Row 1: type/overdue badge + task ID */}
      <div className="mb-2 flex items-center justify-between gap-2">
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
        <div className="flex shrink-0 items-center gap-1">
          {!isCompleted && (
            <span
              aria-hidden="true"
              className="text-light-400 flex h-8 w-8 items-center justify-center sm:h-5 sm:w-4"
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
          <span className="text-light-400 text-[10px] font-medium tracking-wide">{task.id}</span>
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
      <p className="text-dark-500 mb-1.5 text-[13px] leading-snug font-semibold">{task.title}</p>

      {/* Client */}
      <div className="mb-3 flex min-w-0 items-center gap-1.5">
        {clientCode ? (
          <>
            <KanbanClientChip code={clientCode} />
            {clientName ? (
              <span className="text-light-700 min-w-0 truncate text-[11px]">{clientName}</span>
            ) : null}
          </>
        ) : (
          <span className="text-light-400 text-[11px] italic">
            {t('pages.lawyerWorkplace.letterItem.unidentified', 'unidentified')}
          </span>
        )}
      </div>

      <div className="mb-2 h-px w-full bg-gray-100" />

      {/* Footer: deadline + assignee */}
      <div className="flex items-center justify-between gap-2">
        {isCompleted ? (
          /* Completed: closed date is static, no editing */
          task.closedAt ? (
            <span className="text-light-500 text-[11px]">
              {t('pages.lawyerWorkplace.kanban.closedLabel', 'closed')}{' '}
              {formatLegalDueMonthDay(task.closedAt)}
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
                  {formatLegalDueMonthDay(task.deadline)}
                </span>
              ) : (
                <span className="text-light-600 flex items-center gap-1 text-[11px]">
                  <Icons.Calendar size={11} strokeWidth={1.5} className="shrink-0" />
                  {t('pages.lawyerWorkplace.kanban.byLabel', 'by')}{' '}
                  {formatLegalDueMonthDay(task.deadline)}
                </span>
              )
            ) : (
              <span className="text-light-400 flex items-center gap-1 text-[11px] italic">
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
                  className="text-light-400 hover:text-dark-500 focus-visible:ring-primary-500 flex h-8 w-8 items-center justify-center rounded hover:bg-gray-100 focus:outline-none focus-visible:ring-2 sm:h-5 sm:w-5"
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
                {/* Move to column */}
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="cursor-pointer rounded-md px-2 py-1.5 text-[12px]">
                    <span className="flex items-center gap-2">
                      <Icons.ArrowRight size={13} strokeWidth={1.8} className="text-light-500" />
                      {t('pages.lawyerWorkplace.kanban.moveTo', 'Move to')}
                    </span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="min-w-[160px] p-1.5">
                    {COLUMN_MOVE_OPTIONS.filter((col) => col.id !== task.columnId).map((col) => (
                      <DropdownMenuItem
                        key={col.id}
                        className="cursor-pointer rounded-md px-2 py-1.5 text-[12px] focus:bg-gray-50"
                        onClick={(event) => {
                          event.stopPropagation()
                          onMoveTask?.(task.id, col.id)
                        }}
                      >
                        {t(col.labelKey)}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                {/* Change type */}
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="cursor-pointer rounded-md px-2 py-1.5 text-[12px]">
                    <span className="flex items-center gap-2">
                      <Icons.Tag01 size={13} strokeWidth={1.8} className="text-light-500" />
                      {t('pages.lawyerWorkplace.kanban.changeType', 'Change type')}
                    </span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="max-h-60 min-w-[190px] overflow-y-auto p-1.5">
                    {editableLetterTypes.map((letterType) => (
                      <DropdownMenuItem
                        key={letterType.id}
                        className="cursor-pointer rounded-md px-2 py-1.5 focus:bg-gray-50"
                        onClick={(e) => {
                          e.stopPropagation()
                          onTaskUpdate?.(task.id, { letterTypeId: letterType.id })
                        }}
                      >
                        {renderLetterTypeOption(letterType)}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                {/* Change assignee */}
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="cursor-pointer rounded-md px-2 py-1.5 text-[12px]">
                    <span className="flex items-center gap-2">
                      <Icons.UserCircle02Icon
                        size={13}
                        strokeWidth={1.8}
                        className="text-light-500"
                      />
                      {t('pages.lawyerWorkplace.kanban.changeAssignee', 'Change assignee')}
                    </span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="min-w-[170px] p-1.5">
                    {assigneeOptions.map((opt) => (
                      <DropdownMenuItem
                        key={`${opt.initials}-${opt.userId ?? opt.name}`}
                        className={cn(
                          'cursor-pointer rounded-md px-2 py-1.5 text-[12px] focus:bg-gray-50',
                          opt.initials === assigneeInitials && 'bg-gray-50'
                        )}
                        onClick={(e) => {
                          e.stopPropagation()
                          if (opt.userId != null) {
                            onTaskUpdate?.(task.id, { assigneeUserId: opt.userId })
                          }
                        }}
                      >
                        <span className="flex items-center gap-2">
                          <span
                            className={cn(
                              'flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold',
                              getAssigneeColour(opt.userId, opt.initials)
                            )}
                          >
                            {opt.initials}
                          </span>
                          <span className="text-dark-500">{opt.label}</span>
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
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                {/* Set deadline — inline calendar in submenu */}
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="cursor-pointer rounded-md px-2 py-1.5 text-[12px]">
                    <span className="flex items-center gap-2">
                      <Icons.Calendar size={13} strokeWidth={1.8} className="text-light-500" />
                      {t('pages.lawyerWorkplace.kanban.setDeadline', 'Set deadline')}
                    </span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent
                    className="bg-white p-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <DatePicker
                      inline
                      selected={deadline}
                      onChange={(date: Date | null) => {
                        onTaskUpdate?.(task.id, {
                          deadline: date ? legalDueDateToIso(date) : null,
                        })
                      }}
                      calendarStartDay={1}
                      showYearDropdown
                      scrollableYearDropdown
                      yearDropdownItemNumber={10}
                    />
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                <DropdownMenuSeparator />

                {/* Copy task key */}
                <DropdownMenuItem
                  className="cursor-pointer rounded-md px-2 py-1.5 text-[12px] focus:bg-gray-50"
                  onClick={(e) => {
                    e.stopPropagation()
                    navigator.clipboard.writeText(task.id).catch(() => {})
                  }}
                >
                  <span className="flex items-center gap-2">
                    <Icons.Files02Icon size={13} strokeWidth={1.8} className="text-light-500" />
                    {t('pages.lawyerWorkplace.kanban.copyKey', 'Copy task key')}
                  </span>
                </DropdownMenuItem>
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
