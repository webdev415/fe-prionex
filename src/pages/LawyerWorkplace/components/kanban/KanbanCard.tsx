import { useRef, useState, type DragEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import '@/components/ui/DateSelect.theme.css'
import type { LegalKanbanTaskPatch, LegalLawyer, LegalLetterType } from '@/features/lawyerWorkplace'
import { canAssignLawyer } from '@/features/lawyerWorkplace'
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
  formatLegalDueDateTime,
  formatLegalDueMonthDay,
  legalDueDateToIso,
  legalDueDateToPickerDate,
} from '@/features/lawyerWorkplace/utils/legalDueDate'
import {
  CREATE_TASK_PRIORITIES,
  getAssigneeColour,
  KANBAN_COLUMN_MOVE_OPTIONS,
  resolveKanbanTypeBadgeProps,
  type KanbanTaskPriority,
} from './constants'
import { KanbanAssigneeChip } from './KanbanAssigneeChip'
import { KanbanClientChip } from './KanbanClientChip'
import { KanbanPriorityIcon, KanbanPriorityOption } from './KanbanPriorityOption'
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
  timezone?: string | null
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

  // react-datepicker fires onChange twice for one deadline: once when the day
  // is clicked, again when the time slot is. Saving on each meant two writes
  // and — once KAN-1000 added the toast — a first one announcing a time nobody
  // picked. The pick is staged instead and written when the submenu closes.
  //
  // The ref is what decides, not the state: dismissing the menu cascades
  // several onOpenChange(false) calls in one tick, and state set in the first
  // has not flushed by the third, so all three would save. `undefined` means
  // untouched, so opening and closing without picking writes nothing. The
  // state exists only to redraw the calendar around the staged value.
  const pendingDeadlineRef = useRef<Date | null | undefined>(undefined)
  const [deadlineMenuOpen, setDeadlineMenuOpen] = useState(false)
  const [pendingDeadline, setPendingDeadline] = useState<Date | null | undefined>(undefined)

  const stageDeadline = (date: Date | null) => {
    pendingDeadlineRef.current = date
    setPendingDeadline(date)
  }

  const handleDeadlineMenuToggle = (open: boolean) => {
    setDeadlineMenuOpen(open)
    const staged = pendingDeadlineRef.current
    pendingDeadlineRef.current = undefined
    setPendingDeadline(undefined)
    if (open || staged === undefined) return
    onTaskUpdate?.(task.id, {
      deadline: staged ? legalDueDateToIso(staged, timezone) : null,
    })
  }
  const assigneeInitials = task.assigneeInitials
  const assigneeName = task.assigneeName
  const priorityConfig =
    CREATE_TASK_PRIORITIES.find((item) => item.id === task.priority) ??
    CREATE_TASK_PRIORITIES.find((item) => item.id === 'medium')

  const assigneeOptions = lawyers.map((lawyer) => ({
    userId: lawyer.user_id,
    initials: lawyer.initials,
    name: extractAssigneeName(lawyer.display_name),
    label: lawyer.display_name,
    assignable: canAssignLawyer(lawyer, task.assigneeUserId),
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
                <span className="text-muted-foreground min-w-0 truncate text-[11px]">
                  {clientName}
                </span>
              ) : null}
            </Link>
          ) : (
            <>
              <KanbanClientChip code={clientCode} />
              {clientName ? (
                <span className="text-muted-foreground min-w-0 truncate text-[11px]">
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
                {/* Move to column */}
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="cursor-pointer rounded-md px-2 py-1.5 text-[12px]">
                    <span className="flex items-center gap-2">
                      <Icons.ArrowRight
                        size={13}
                        strokeWidth={1.8}
                        className="text-muted-foreground"
                      />
                      {t('pages.lawyerWorkplace.kanban.moveTo', 'Move to')}
                    </span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="min-w-[160px] p-1.5">
                    {COLUMN_MOVE_OPTIONS.filter((col) => col.id !== task.columnId).map((col) => (
                      <DropdownMenuItem
                        key={col.id}
                        className="focus:bg-muted cursor-pointer rounded-md px-2 py-1.5 text-[12px]"
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
                      <Icons.Tag01 size={13} strokeWidth={1.8} className="text-muted-foreground" />
                      {t('pages.lawyerWorkplace.kanban.changeType', 'Change type')}
                    </span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="max-h-60 min-w-[190px] overflow-y-auto p-1.5">
                    {editableLetterTypes.map((letterType) => (
                      <DropdownMenuItem
                        key={letterType.id}
                        className="focus:bg-muted cursor-pointer rounded-md px-2 py-1.5"
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
                        className="text-muted-foreground"
                      />
                      {t('pages.lawyerWorkplace.kanban.changeAssignee', 'Change assignee')}
                    </span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="min-w-[170px] p-1.5">
                    {assigneeOptions.map((opt) => {
                      const lawyer = lawyers.find((item) => item.user_id === opt.userId)
                      return (
                        <DropdownMenuItem
                          key={`${opt.initials}-${opt.userId ?? opt.name}`}
                          disabled={!opt.assignable}
                          className={cn(
                            'focus:bg-muted rounded-md px-2 py-1.5 text-[12px]',
                            opt.assignable ? 'cursor-pointer' : 'cursor-not-allowed opacity-50',
                            opt.initials === assigneeInitials && 'bg-muted'
                          )}
                          onClick={(e) => {
                            e.stopPropagation()
                            if (!opt.assignable || opt.userId == null) return
                            onTaskUpdate?.(task.id, { assigneeUserId: opt.userId })
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
                            <span className="text-foreground flex min-w-0 flex-col">
                              <span>{opt.label}</span>
                              {!opt.assignable && lawyer ? (
                                <span className="text-muted-foreground text-[10px]">
                                  {t('pages.lawyerWorkplace.lawyers.atCapacity', {
                                    current: lawyer.current_active,
                                    max: lawyer.max_in_flight,
                                    defaultValue: `At capacity (${lawyer.current_active}/${lawyer.max_in_flight})`,
                                  })}
                                </span>
                              ) : null}
                            </span>
                            {opt.initials === assigneeInitials && (
                              <Icons.Checkmark
                                size={12}
                                className="text-primary-600 ml-auto"
                                strokeWidth={2}
                              />
                            )}
                          </span>
                        </DropdownMenuItem>
                      )
                    })}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                {/* Change priority */}
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="cursor-pointer rounded-md px-2 py-1.5 text-[12px]">
                    <span className="flex items-center gap-2">
                      <Icons.Flash size={13} strokeWidth={1.8} className="text-muted-foreground" />
                      {t('pages.lawyerWorkplace.kanban.changePriority', 'Change priority')}
                    </span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="min-w-[160px] p-1.5">
                    {CREATE_TASK_PRIORITIES.filter((item) =>
                      (['high', 'medium', 'low'] as KanbanTaskPriority[]).includes(item.id)
                    ).map((item) => (
                      <DropdownMenuItem
                        key={item.id}
                        className={cn(
                          'focus:bg-muted cursor-pointer rounded-md px-2 py-1.5',
                          item.id === task.priority && 'bg-muted'
                        )}
                        onClick={(e) => {
                          e.stopPropagation()
                          onTaskUpdate?.(task.id, { priority: item.id })
                        }}
                      >
                        <KanbanPriorityOption priority={item.id} className="text-[12px]" />
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                {/* Set deadline — inline calendar + time in submenu */}
                <DropdownMenuSub open={deadlineMenuOpen} onOpenChange={handleDeadlineMenuToggle}>
                  <DropdownMenuSubTrigger className="cursor-pointer rounded-md px-2 py-1.5 text-[12px]">
                    <span className="flex items-center gap-2">
                      <Icons.Calendar
                        size={13}
                        strokeWidth={1.8}
                        className="text-muted-foreground"
                      />
                      {t('pages.lawyerWorkplace.kanban.setDeadline', 'Set deadline')}
                    </span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent
                    className="bg-card p-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="date-select-wrapper">
                      <DatePicker
                        inline
                        selected={pendingDeadline === undefined ? deadline : pendingDeadline}
                        onChange={stageDeadline}
                        showTimeSelect
                        timeFormat="HH:mm"
                        timeIntervals={15}
                        dateFormat="dd/MM/yyyy HH:mm"
                        calendarStartDay={1}
                        showYearDropdown
                        scrollableYearDropdown
                        yearDropdownItemNumber={10}
                        calendarClassName="date-select-calendar"
                      />
                    </div>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                <DropdownMenuSeparator />

                {/* Copy task key */}
                <DropdownMenuItem
                  className="focus:bg-muted cursor-pointer rounded-md px-2 py-1.5 text-[12px]"
                  onClick={(e) => {
                    e.stopPropagation()
                    navigator.clipboard.writeText(task.id).catch(() => {})
                  }}
                >
                  <span className="flex items-center gap-2">
                    <Icons.Files02Icon
                      size={13}
                      strokeWidth={1.8}
                      className="text-muted-foreground"
                    />
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
