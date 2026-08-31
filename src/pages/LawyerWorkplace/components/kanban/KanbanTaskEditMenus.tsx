/* eslint-disable react-refresh/only-export-components */
import { useRef, useState, type MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import '@/components/ui/DateSelect.theme.css'
import type { LegalKanbanTaskPatch, LegalLawyer, LegalLetterType } from '@/features/lawyerWorkplace'
import { canAssignLawyer } from '@/features/lawyerWorkplace'
import {
  legalDueDateToIso,
  legalDueDateToPickerDate,
} from '@/features/lawyerWorkplace/utils/legalDueDate'
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/DropdownMenu'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import type { KanbanColumnId, KanbanTask } from '../../kanban/kanbanData'
import {
  CREATE_TASK_PRIORITIES,
  getAssigneeColour,
  KANBAN_COLUMN_MOVE_OPTIONS,
  resolveKanbanTypeBadgeProps,
  type KanbanTaskPriority,
} from './constants'
import { KanbanPriorityOption } from './KanbanPriorityOption'
import { KanbanTypeBadge } from './KanbanTypeBadge'

/**
 * The task-edit actions shared between the small kanban card ("..." menu) and
 * the opened task drawer/detail panel. Lawyers could not find the card's
 * kebab menu, so the same options are surfaced inside the open task view —
 * one implementation, two entry points.
 */

export function extractAssigneeName(displayName: string): string {
  const parts = displayName.trim().split(/\s+/)
  return parts[parts.length - 1] ?? displayName
}

export interface KanbanAssigneeOption {
  userId: number | null
  initials: string
  name: string
  label: string
  assignable: boolean
}

export function buildKanbanAssigneeOptions(
  lawyers: LegalLawyer[],
  currentAssigneeUserId: number | null
): KanbanAssigneeOption[] {
  return lawyers.map((lawyer) => ({
    userId: lawyer.user_id,
    initials: lawyer.initials,
    name: extractAssigneeName(lawyer.display_name),
    label: lawyer.display_name,
    assignable: canAssignLawyer(lawyer, currentAssigneeUserId),
  }))
}

function stop(event: MouseEvent) {
  event.stopPropagation()
}

interface MoveToItemsProps {
  task: KanbanTask
  onMoveTask?: (taskId: string, columnId: KanbanColumnId) => void
}

/** Column options (minus the current one); works inside any menu content. */
export function KanbanMoveToMenuItems({ task, onMoveTask }: MoveToItemsProps) {
  const { t } = useTranslation('common')
  return (
    <>
      {KANBAN_COLUMN_MOVE_OPTIONS.filter((col) => col.id !== task.columnId).map((col) => (
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
    </>
  )
}

interface TypeItemsProps {
  task: KanbanTask
  editableLetterTypes: LegalLetterType[]
  onTaskUpdate?: (taskId: string, patch: LegalKanbanTaskPatch) => void
}

export function KanbanTypeMenuItems({ task, editableLetterTypes, onTaskUpdate }: TypeItemsProps) {
  return (
    <>
      {editableLetterTypes.map((letterType) => {
        const badge = resolveKanbanTypeBadgeProps(letterType.id, [letterType], 'type_pending')
        return (
          <DropdownMenuItem
            key={letterType.id}
            className="focus:bg-muted cursor-pointer rounded-md px-2 py-1.5"
            onClick={(event) => {
              event.stopPropagation()
              onTaskUpdate?.(task.id, { letterTypeId: letterType.id })
            }}
          >
            <KanbanTypeBadge type={badge.type} label={badge.label} colorId={badge.colorId} />
          </DropdownMenuItem>
        )
      })}
    </>
  )
}

interface AssigneeItemsProps {
  task: KanbanTask
  lawyers: LegalLawyer[]
  onTaskUpdate?: (taskId: string, patch: LegalKanbanTaskPatch) => void
}

export function KanbanAssigneeMenuItems({ task, lawyers, onTaskUpdate }: AssigneeItemsProps) {
  const { t } = useTranslation('common')
  const options = buildKanbanAssigneeOptions(lawyers, task.assigneeUserId)
  return (
    <>
      {options.map((opt) => {
        const lawyer = lawyers.find((item) => item.user_id === opt.userId)
        return (
          <DropdownMenuItem
            key={`${opt.initials}-${opt.userId ?? opt.name}`}
            disabled={!opt.assignable}
            className={cn(
              'focus:bg-muted rounded-md px-2 py-1.5 text-[12px]',
              opt.assignable ? 'cursor-pointer' : 'cursor-not-allowed opacity-50',
              opt.initials === task.assigneeInitials && 'bg-muted'
            )}
            onClick={(event) => {
              event.stopPropagation()
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
              {opt.initials === task.assigneeInitials && (
                <Icons.Checkmark size={12} className="text-primary-600 ml-auto" strokeWidth={2} />
              )}
            </span>
          </DropdownMenuItem>
        )
      })}
    </>
  )
}

interface PriorityItemsProps {
  task: KanbanTask
  onTaskUpdate?: (taskId: string, patch: LegalKanbanTaskPatch) => void
}

export function KanbanPriorityMenuItems({ task, onTaskUpdate }: PriorityItemsProps) {
  return (
    <>
      {CREATE_TASK_PRIORITIES.filter((item) =>
        (['high', 'medium', 'low'] as KanbanTaskPriority[]).includes(item.id)
      ).map((item) => (
        <DropdownMenuItem
          key={item.id}
          className={cn(
            'focus:bg-muted cursor-pointer rounded-md px-2 py-1.5',
            item.id === task.priority && 'bg-muted'
          )}
          onClick={(event) => {
            event.stopPropagation()
            onTaskUpdate?.(task.id, { priority: item.id })
          }}
        >
          <KanbanPriorityOption priority={item.id} className="text-[12px]" />
        </DropdownMenuItem>
      ))}
    </>
  )
}

// react-datepicker fires onChange twice for one deadline: once when the day
// is clicked, again when the time slot is. Saving on each meant two writes
// and — once KAN-1000 added the toast — a first one announcing a time nobody
// picked. The pick is staged instead and written when the menu closes.
//
// The ref is what decides, not the state: dismissing the menu cascades
// several onOpenChange(false) calls in one tick, and state set in the first
// has not flushed by the third, so all three would save. `undefined` means
// untouched, so opening and closing without picking writes nothing. The
// state exists only to redraw the calendar around the staged value.
export function useStagedDeadlinePicker({
  deadline,
  onSave,
}: {
  deadline: Date | null
  onSave: (staged: Date | null) => void
}) {
  const pendingRef = useRef<Date | null | undefined>(undefined)
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState<Date | null | undefined>(undefined)

  const stage = (date: Date | null) => {
    pendingRef.current = date
    setPending(date)
  }

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    const staged = pendingRef.current
    pendingRef.current = undefined
    setPending(undefined)
    if (nextOpen || staged === undefined) return
    onSave(staged)
  }

  return {
    open,
    handleOpenChange,
    selected: pending === undefined ? deadline : pending,
    stage,
  }
}

export function KanbanDeadlineCalendar({
  selected,
  onChange,
}: {
  selected: Date | null
  onChange: (date: Date | null) => void
}) {
  return (
    <div className="date-select-wrapper">
      <DatePicker
        inline
        selected={selected}
        onChange={onChange}
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
  )
}

export interface KanbanTaskActionsMenuItemsProps {
  task: KanbanTask
  lawyers: LegalLawyer[]
  /** Active letter types shown in the change-type submenu. */
  editableLetterTypes: LegalLetterType[]
  timezone?: string | null
  onMoveTask?: (taskId: string, columnId: KanbanColumnId) => void
  onTaskUpdate?: (taskId: string, patch: LegalKanbanTaskPatch) => void
}

/**
 * Full task actions menu body (Move to / Change type / Change assignee /
 * Change priority / Set deadline / Copy key). Render inside a
 * DropdownMenuContent — used by the card's "..." menu and the thread drawer.
 */
export function KanbanTaskActionsMenuItems({
  task,
  lawyers,
  editableLetterTypes,
  timezone,
  onMoveTask,
  onTaskUpdate,
}: KanbanTaskActionsMenuItemsProps) {
  const { t } = useTranslation('common')
  const deadlinePicker = useStagedDeadlinePicker({
    deadline: legalDueDateToPickerDate(task.deadline, timezone),
    onSave: (staged) =>
      onTaskUpdate?.(task.id, {
        deadline: staged ? legalDueDateToIso(staged, timezone) : null,
      }),
  })

  return (
    <>
      {/* Move to column */}
      <DropdownMenuSub>
        <DropdownMenuSubTrigger className="cursor-pointer rounded-md px-2 py-1.5 text-[12px]">
          <span className="flex items-center gap-2">
            <Icons.ArrowRight size={13} strokeWidth={1.8} className="text-muted-foreground" />
            {t('pages.lawyerWorkplace.kanban.moveTo', 'Move to')}
          </span>
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent className="min-w-[160px] p-1.5">
          <KanbanMoveToMenuItems task={task} onMoveTask={onMoveTask} />
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
          <KanbanTypeMenuItems
            task={task}
            editableLetterTypes={editableLetterTypes}
            onTaskUpdate={onTaskUpdate}
          />
        </DropdownMenuSubContent>
      </DropdownMenuSub>

      {/* Change assignee */}
      <DropdownMenuSub>
        <DropdownMenuSubTrigger className="cursor-pointer rounded-md px-2 py-1.5 text-[12px]">
          <span className="flex items-center gap-2">
            <Icons.UserCircle02Icon size={13} strokeWidth={1.8} className="text-muted-foreground" />
            {t('pages.lawyerWorkplace.kanban.changeAssignee', 'Change assignee')}
          </span>
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent className="min-w-[170px] p-1.5">
          <KanbanAssigneeMenuItems task={task} lawyers={lawyers} onTaskUpdate={onTaskUpdate} />
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
          <KanbanPriorityMenuItems task={task} onTaskUpdate={onTaskUpdate} />
        </DropdownMenuSubContent>
      </DropdownMenuSub>

      {/* Set deadline — inline calendar + time in submenu */}
      <DropdownMenuSub open={deadlinePicker.open} onOpenChange={deadlinePicker.handleOpenChange}>
        <DropdownMenuSubTrigger className="cursor-pointer rounded-md px-2 py-1.5 text-[12px]">
          <span className="flex items-center gap-2">
            <Icons.Calendar size={13} strokeWidth={1.8} className="text-muted-foreground" />
            {t('pages.lawyerWorkplace.kanban.setDeadline', 'Set deadline')}
          </span>
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent className="bg-card p-2" onClick={stop}>
          <KanbanDeadlineCalendar
            selected={deadlinePicker.selected}
            onChange={deadlinePicker.stage}
          />
        </DropdownMenuSubContent>
      </DropdownMenuSub>

      <DropdownMenuSeparator />

      {/* Copy task key */}
      <DropdownMenuItem
        className="focus:bg-muted cursor-pointer rounded-md px-2 py-1.5 text-[12px]"
        onClick={(event) => {
          event.stopPropagation()
          navigator.clipboard.writeText(task.id).catch(() => {})
        }}
      >
        <span className="flex items-center gap-2">
          <Icons.Files02Icon size={13} strokeWidth={1.8} className="text-muted-foreground" />
          {t('pages.lawyerWorkplace.kanban.copyKey', 'Copy task key')}
        </span>
      </DropdownMenuItem>
    </>
  )
}
