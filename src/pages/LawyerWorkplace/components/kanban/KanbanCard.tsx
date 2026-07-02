import { useState, useRef, useEffect, type DragEvent } from 'react'
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
import { useClients } from '@/features/clients/hooks/useClients'
import { useDebounce } from '@/hooks/useDebounce'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import type { KanbanColumnId, KanbanTask, KanbanTaskType } from '../../kanban/kanbanData'
import { formatKanbanMonthDay } from '../../utils/formatters'
import { ASSIGNEE_COLOURS, CREATE_TASK_PRIORITIES, KANBAN_COLUMN_MOVE_OPTIONS } from './constants'
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

const COLUMN_MOVE_OPTIONS = KANBAN_COLUMN_MOVE_OPTIONS

const KNOWN_KANBAN_TYPES = new Set<KanbanTaskType>([
  'complaint',
  'nbu_inquiry',
  'court_claim',
  'attorney_request',
  'inquiry',
])

function renderLetterTypeOption(letterTypeId: string, name: string) {
  if (KNOWN_KANBAN_TYPES.has(letterTypeId as KanbanTaskType)) {
    return <KanbanTypeBadge type={letterTypeId as KanbanTaskType} />
  }
  return <span className="text-dark-500 text-[12px]">{name}</span>
}

interface KanbanCardProps {
  task: KanbanTask
  lawyers: LegalLawyer[]
  letterTypes: LegalLetterType[]
  isDragging?: boolean
  onCardClick?: (letterId: string) => void
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
  isDragging = false,
  onCardClick,
  onMoveTask,
  onTaskUpdate,
  onDragStart,
  onDragEnd,
}: KanbanCardProps) {
  const { t } = useTranslation('common')
  const [clientSubOpen, setClientSubOpen] = useState(false)
  const [clientSearch, setClientSearch] = useState('')
  const clientSearchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (clientSubOpen) {
      requestAnimationFrame(() => clientSearchRef.current?.focus())
    }
  }, [clientSubOpen])
  const debouncedClientSearch = useDebounce(clientSearch, 300)
  const { data: clientsData, isFetching: clientsLoading } = useClients(
    { q: debouncedClientSearch, limit: 20 },
    { enabled: clientSubOpen && debouncedClientSearch.length >= 2 }
  )
  const isOverdue = task.columnId === 'overdue'
  const isCompleted = task.columnId === 'completed'
  const taskType = task.type
  const clientCode = task.clientCode ?? null
  const clientName = task.clientName ?? null

  const deadline = parseDeadline(task.deadline)
  const priority = task.priority
  const assigneeInitials = task.assigneeInitials
  const assigneeName = task.assigneeName

  const assigneeOptions = lawyers.map((lawyer) => ({
    userId: lawyer.user_id,
    initials: lawyer.initials,
    name: extractAssigneeName(lawyer.display_name),
    label: lawyer.display_name,
  }))

  const priorityConfig = CREATE_TASK_PRIORITIES.find((item) => item.id === priority)

  const getAssigneeLabel = (initials: string, fallbackName: string) => {
    const option = assigneeOptions.find((item) => item.initials === initials)
    return option?.label ?? fallbackName
  }

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
              className="text-light-400 hover:text-light-600 flex h-8 w-8 cursor-grab items-center justify-center rounded active:cursor-grabbing sm:h-5 sm:w-4"
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

                {/* Set client */}
                <DropdownMenuSub
                  onOpenChange={(open) => {
                    setClientSubOpen(open)
                    if (!open) setClientSearch('')
                  }}
                >
                  <DropdownMenuSubTrigger className="cursor-pointer rounded-md px-2 py-1.5 text-[12px]">
                    <span className="flex items-center gap-2">
                      <Icons.User size={13} strokeWidth={1.8} className="text-light-500" />
                      {t('pages.lawyerWorkplace.kanban.setClient', 'Set client')}
                    </span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="min-w-[220px] p-0">
                    {/* Search input */}
                    <div className="border-b border-gray-100 p-2">
                      <div className="relative">
                        <Icons.Search
                          size={13}
                          className="absolute top-1/2 left-2 -translate-y-1/2 text-gray-400"
                          strokeWidth={1.5}
                        />
                        <input
                          type="text"
                          value={clientSearch}
                          onChange={(e) => setClientSearch(e.target.value)}
                          onKeyDown={(e) => e.stopPropagation()}
                          placeholder={t(
                            'pages.lawyerWorkplace.kanban.searchClient',
                            'Search client…'
                          )}
                          ref={clientSearchRef}
                          className="text-dark-500 h-7 w-full rounded border border-gray-200 bg-gray-50 pr-2 pl-6 text-[11px] outline-none placeholder:text-gray-400"
                        />
                      </div>
                    </div>
                    {/* Results */}
                    <div className="max-h-52 overflow-y-auto p-1.5">
                      {clientsLoading ? (
                        <div className="flex items-center justify-center py-4">
                          <svg
                            className="h-4 w-4 animate-spin text-gray-400"
                            viewBox="0 0 24 24"
                            fill="none"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8v8H4z"
                            />
                          </svg>
                        </div>
                      ) : debouncedClientSearch.length < 2 ? (
                        <p className="px-2 py-4 text-center text-[11px] text-gray-400">
                          {t(
                            'pages.lawyerWorkplace.kanban.clientSearchHint',
                            'Type 2+ characters…'
                          )}
                        </p>
                      ) : (clientsData?.items ?? []).length === 0 ? (
                        <p className="px-2 py-4 text-center text-[11px] text-gray-400">
                          {t('pages.lawyerWorkplace.kanban.noClientsFound', 'No clients found')}
                        </p>
                      ) : (
                        (clientsData?.items ?? []).map((client) => {
                          const code =
                            client.legacy_id?.trim() || `CL-${String(client.id).padStart(5, '0')}`
                          const displayName = [client.first_name, client.last_name]
                            .filter(Boolean)
                            .join(' ')
                          return (
                            <DropdownMenuItem
                              key={client.id}
                              className={cn(
                                'cursor-pointer rounded-md px-2 py-1.5 text-[12px] focus:bg-gray-50',
                                clientCode === code && 'bg-gray-50'
                              )}
                              onClick={(e) => {
                                e.stopPropagation()
                                onTaskUpdate?.(task.id, {
                                  clientId: client.id,
                                  clientName: displayName,
                                })
                              }}
                            >
                              <span className="flex items-center gap-2">
                                <KanbanClientChip code={code} />
                                <span className="text-dark-500">{displayName}</span>
                                {clientCode === code && (
                                  <Icons.Checkmark
                                    size={12}
                                    className="text-primary-600 ml-auto"
                                    strokeWidth={2}
                                  />
                                )}
                              </span>
                            </DropdownMenuItem>
                          )
                        })
                      )}
                      {clientCode ? (
                        <DropdownMenuItem
                          className="cursor-pointer rounded-md px-2 py-1.5 text-[12px] text-gray-500 focus:bg-gray-50"
                          onClick={(e) => {
                            e.stopPropagation()
                            onTaskUpdate?.(task.id, { clientId: null, clientName: null })
                          }}
                        >
                          {t('pages.lawyerWorkplace.kanban.clearClient', 'Clear client')}
                        </DropdownMenuItem>
                      ) : null}
                    </div>
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
                    {letterTypes.map((letterType) => (
                      <DropdownMenuItem
                        key={letterType.id}
                        className="cursor-pointer rounded-md px-2 py-1.5 focus:bg-gray-50"
                        onClick={(e) => {
                          e.stopPropagation()
                          onTaskUpdate?.(task.id, { letterTypeId: letterType.id })
                        }}
                      >
                        {renderLetterTypeOption(letterType.id, letterType.name)}
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
                          onTaskUpdate?.(task.id, { priority: opt.id })
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
                              ASSIGNEE_COLOURS[opt.initials] ?? 'bg-gray-100 text-gray-500'
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
                        onTaskUpdate?.(task.id, { deadline: date ? date.toISOString() : null })
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
          />
        </div>
      </div>
    </div>
  )
}
