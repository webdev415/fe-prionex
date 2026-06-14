import { useState, type DragEvent } from 'react'
import { useTranslation } from 'react-i18next'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
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
import type { KanbanColumnId, KanbanTask, KanbanTaskType } from '../../kanban/kanbanData'
import { formatKanbanMonthDay } from '../../utils/formatters'
import {
  ASSIGNEE_COLOURS,
  CREATE_TASK_PRIORITIES,
  CREATE_TASK_TYPES,
  type KanbanTaskPriority,
} from './constants'
import { KanbanAssigneeChip } from './KanbanAssigneeChip'
import { KanbanClientChip } from './KanbanClientChip'
import { KanbanPriorityIcon, KanbanPriorityOption } from './KanbanPriorityOption'
import { KanbanTypeBadge } from './KanbanTypeBadge'

function parseDeadline(iso: string | undefined | null): Date | null {
  if (!iso) return null
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return new Date(+m[1], +m[2] - 1, +m[3], 0, 0, 0, 0)
  const d = new Date(iso)
  return isNaN(d.getTime()) ? null : d
}

function fmtMonthDay(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${mm}/${dd}`
}

const ASSIGNEE_OPTIONS = [
  { initials: 'VD', name: 'Doroshenko' },
  { initials: 'LK', name: 'Kostenko' },
  { initials: 'SM', name: 'Melnychenko' },
  { initials: 'ON', name: 'manager' },
]

const CLIENT_OPTIONS = [
  { code: 'CL-08114', name: 'I. Petrenko' },
  { code: 'CL-12409', name: 'O. Kovalenko' },
  { code: 'CL-06441', name: 'P. Melnyk' },
  { code: 'CL-09908', name: 'V. Khomenko' },
  { code: 'CL-03305', name: 'M. Bondarenko' },
  { code: 'CL-07750', name: 'L. Savchenko' },
  { code: 'CL-04412', name: 'T. Romaniuk' },
  { code: 'CL-05588', name: 'H. Tkachenko' },
  { code: 'CL-02211', name: 'O. Vasylenko' },
]

const COLUMN_MOVE_OPTIONS = [
  {
    id: 'not_defined' as const,
    labelKey: 'pages.lawyerWorkplace.kanban.columns.notDefined',
    fallback: 'Not Defined',
  },
  {
    id: 'in_progress' as const,
    labelKey: 'pages.lawyerWorkplace.kanban.columns.inProgress',
    fallback: 'In Progress',
  },
  {
    id: 'overdue' as const,
    labelKey: 'pages.lawyerWorkplace.kanban.columns.overdue',
    fallback: 'Overdue',
  },
  {
    id: 'completed' as const,
    labelKey: 'pages.lawyerWorkplace.kanban.columns.completed',
    fallback: 'Done',
  },
]

interface KanbanCardProps {
  task: KanbanTask
  isDragging?: boolean
  onCardClick?: (letterId: string) => void
  onMoveTask?: (taskId: string, columnId: KanbanColumnId) => void
  onDragStart?: (event: DragEvent, task: KanbanTask) => void
  onDragEnd?: () => void
}

export function KanbanCard({
  task,
  isDragging = false,
  onCardClick,
  onMoveTask,
  onDragStart,
  onDragEnd,
}: KanbanCardProps) {
  const { t } = useTranslation('common')
  const isOverdue = task.columnId === 'overdue'
  const isCompleted = task.columnId === 'completed'
  const [assigneeInitials, setAssigneeInitials] = useState(task.assigneeInitials)
  const [assigneeName, setAssigneeName] = useState(task.assigneeName)
  const [taskType, setTaskType] = useState<KanbanTaskType>(task.type)
  const [priority, setPriority] = useState<KanbanTaskPriority>(task.priority)
  const [deadline, setDeadline] = useState<Date | null>(parseDeadline(task.deadline))
  const [clientCode, setClientCode] = useState<string | null>(task.clientCode ?? null)
  const [clientName, setClientName] = useState<string | null>(task.clientName ?? null)

  const priorityConfig = CREATE_TASK_PRIORITIES.find((item) => item.id === priority)

  const isClickable = task.letterId && !isCompleted

  const handleCardClick = () => {
    if (isClickable) {
      onCardClick?.(task.letterId!)
    }
  }

  return (
    <div
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
        isOverdue ? 'border-error-400 border-l-2' : '',
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
          <KanbanTypeBadge type={taskType} />
        )}
        <div className="flex shrink-0 items-center gap-1">
          {!isCompleted && (
            <button
              type="button"
              draggable
              onDragStart={(event) => onDragStart?.(event, task)}
              onDragEnd={onDragEnd}
              onClick={(event) => event.stopPropagation()}
              aria-label={t('pages.lawyerWorkplace.kanban.dragTask', 'Drag task')}
              className="text-light-400 hover:text-light-600 flex h-5 w-4 cursor-grab items-center justify-center rounded active:cursor-grabbing"
            >
              <svg width="8" height="12" viewBox="0 0 8 12" fill="currentColor" aria-hidden="true">
                <circle cx="2" cy="2" r="1.2" />
                <circle cx="6" cy="2" r="1.2" />
                <circle cx="2" cy="6" r="1.2" />
                <circle cx="6" cy="6" r="1.2" />
                <circle cx="2" cy="10" r="1.2" />
                <circle cx="6" cy="10" r="1.2" />
              </svg>
            </button>
          )}
          <span className="text-light-400 text-[10px] font-medium tracking-wide">{task.id}</span>
        </div>
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
        {clientCode ? (
          <>
            <KanbanClientChip code={clientCode} />
            <span className="text-light-700 truncate text-[11px]">{clientName}</span>
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
        {isCompleted ? (
          /* Completed: closed date is static, no editing */
          task.closedAt ? (
            <span className="text-light-500 text-[11px]">
              {t('pages.lawyerWorkplace.kanban.closedLabel', 'closed')}{' '}
              {formatKanbanMonthDay(task.closedAt)}
            </span>
          ) : null
        ) : (
          /* Active columns: date display (editing via "..." menu) */
          <>
            {deadline ? (
              isOverdue ? (
                <span className="text-error-600 flex items-center gap-1 text-[11px] font-medium">
                  <Icons.Calendar size={11} strokeWidth={1.5} className="shrink-0" />
                  {t('pages.lawyerWorkplace.kanban.dueLabel', 'due:')} {fmtMonthDay(deadline)}
                </span>
              ) : (
                <span className="text-light-600 flex items-center gap-1 text-[11px]">
                  <Icons.Calendar size={11} strokeWidth={1.5} className="shrink-0" />
                  {t('pages.lawyerWorkplace.kanban.byLabel', 'by')} {fmtMonthDay(deadline)}
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
          {/* Priority: always static — edit via "..." menu */}
          <span
            className="flex h-4 w-4 items-center justify-center"
            title={priorityConfig ? t(priorityConfig.key, priorityConfig.fallback) : undefined}
            aria-hidden="true"
          >
            <KanbanPriorityIcon priority={priority} />
          </span>

          {/* More options "..." — only for active columns */}
          {!isCompleted && (
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => e.stopPropagation()}
                  className="text-light-400 hover:text-dark-500 focus-visible:ring-primary-500 flex h-5 w-5 items-center justify-center rounded hover:bg-gray-100 focus:outline-none focus-visible:ring-2"
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
                        {t(col.labelKey, col.fallback)}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                {/* Set client */}
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="cursor-pointer rounded-md px-2 py-1.5 text-[12px]">
                    <span className="flex items-center gap-2">
                      <Icons.User size={13} strokeWidth={1.8} className="text-light-500" />
                      {t('pages.lawyerWorkplace.kanban.setClient', 'Set client')}
                    </span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="min-w-[190px] p-1.5">
                    {CLIENT_OPTIONS.map((opt) => (
                      <DropdownMenuItem
                        key={opt.code}
                        className={cn(
                          'cursor-pointer rounded-md px-2 py-1.5 text-[12px] focus:bg-gray-50',
                          opt.code === clientCode && 'bg-gray-50'
                        )}
                        onClick={(e) => {
                          e.stopPropagation()
                          setClientCode(opt.code)
                          setClientName(opt.name)
                        }}
                      >
                        <span className="flex items-center gap-2">
                          <KanbanClientChip code={opt.code} />
                          <span className="text-dark-500">{opt.name}</span>
                          {opt.code === clientCode && (
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

                {/* Change type */}
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="cursor-pointer rounded-md px-2 py-1.5 text-[12px]">
                    <span className="flex items-center gap-2">
                      <Icons.Tag01 size={13} strokeWidth={1.8} className="text-light-500" />
                      {t('pages.lawyerWorkplace.kanban.changeType', 'Change type')}
                    </span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="p-1.5">
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
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                {/* Change priority */}
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="cursor-pointer rounded-md px-2 py-1.5 text-[12px]">
                    <span className="flex items-center gap-2">
                      <Icons.ArrowUpDouble size={13} strokeWidth={1.8} className="text-light-500" />
                      {t('pages.lawyerWorkplace.kanban.changePriority', 'Change priority')}
                    </span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="min-w-[150px] p-1.5">
                    {CREATE_TASK_PRIORITIES.map((opt) => (
                      <DropdownMenuItem
                        key={opt.id}
                        className={cn(
                          'cursor-pointer rounded-md px-2 py-1.5 focus:bg-gray-50',
                          opt.id === priority && 'bg-gray-50'
                        )}
                        onClick={(e) => {
                          e.stopPropagation()
                          setPriority(opt.id)
                        }}
                      >
                        <KanbanPriorityOption priority={opt.id} />
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
                      onChange={(date: Date | null) => setDeadline(date)}
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
          <KanbanAssigneeChip initials={assigneeInitials} name={assigneeName} />
        </div>
      </div>
    </div>
  )
}
