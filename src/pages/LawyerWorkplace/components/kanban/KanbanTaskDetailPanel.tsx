import { forwardRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import { Button } from '@/components/ui/Button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { useLegalProfileTimezone } from '@/features/lawyerWorkplace/hooks/useLegalProfileTimezone'
import {
  formatLegalDueDateTime,
  legalDueDateToIso,
  legalDueDateToPickerDate,
  parseLegalDueDate,
} from '@/features/lawyerWorkplace/utils/legalDueDate'
import type { LegalKanbanTaskPatch, LegalLawyer, LegalLetterType } from '@/features/lawyerWorkplace'
import type { KanbanColumnId, KanbanTask } from '../../kanban/kanbanData'
import { KANBAN_COLUMN_MOVE_OPTIONS, resolveKanbanTypeBadgeProps } from './constants'
import { KanbanAssigneeChip } from './KanbanAssigneeChip'
import { KanbanClientChip } from './KanbanClientChip'
import { KanbanPriorityOption } from './KanbanPriorityOption'
import {
  KanbanAssigneeMenuItems,
  KanbanDeadlineCalendar,
  KanbanMoveToMenuItems,
  KanbanPriorityMenuItems,
  KanbanTypeMenuItems,
  useStagedDeadlinePicker,
} from './KanbanTaskEditMenus'
import { KanbanTypeBadge } from './KanbanTypeBadge'

interface KanbanTaskDetailPanelProps {
  task: KanbanTask
  letterTypes?: LegalLetterType[]
  lawyers?: LegalLawyer[]
  /** Active letter types offered in the change-type menu. */
  editableLetterTypes?: LegalLetterType[]
  onMoveTask?: (taskId: string, columnId: KanbanColumnId) => void
  onTaskUpdate?: (taskId: string, patch: LegalKanbanTaskPatch) => void
}

/**
 * Trigger used by every inline field editor: current value + chevron.
 * Forwards ref/props so Radix's `asChild` trigger wiring reaches the button.
 */
const FieldEditTrigger = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }
>(function FieldEditTrigger({ label, children, ...props }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      title={label}
      aria-label={label}
      className="hover:bg-muted focus-visible:ring-primary-500 -mx-1.5 flex w-fit cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-1 text-left focus:outline-none focus-visible:ring-2"
      {...props}
    >
      {children}
      <Icons.ArrowDown size={13} strokeWidth={1.5} className="text-muted-foreground shrink-0" />
    </button>
  )
})

export function KanbanTaskDetailPanel({
  task,
  letterTypes = [],
  lawyers = [],
  editableLetterTypes = [],
  onMoveTask,
  onTaskUpdate,
}: KanbanTaskDetailPanelProps) {
  const { t, i18n } = useTranslation('common')
  const timezone = useLegalProfileTimezone()
  const deadline = parseLegalDueDate(task.deadline)
  const typeBadge = resolveKanbanTypeBadgeProps(task.letterTypeId, letterTypes, task.type)

  const isCompleted = task.columnId === 'completed'
  const canUpdate = !isCompleted && onTaskUpdate != null
  const canMove = !isCompleted && onMoveTask != null

  const columnOption = KANBAN_COLUMN_MOVE_OPTIONS.find((col) => col.id === task.columnId)
  const columnLabel = columnOption ? t(columnOption.labelKey, columnOption.id) : task.columnId

  const deadlinePicker = useStagedDeadlinePicker({
    deadline: legalDueDateToPickerDate(task.deadline, timezone),
    onSave: (staged) =>
      onTaskUpdate?.(task.id, {
        deadline: staged ? legalDueDateToIso(staged, timezone) : null,
      }),
  })

  const deadlineText = deadline ? (
    formatLegalDueDateTime(task.deadline, timezone, i18n.language)
  ) : (
    <span className="text-muted-foreground italic">
      {t('pages.lawyerWorkplace.kanban.noDeadline', 'no deadline set')}
    </span>
  )

  return (
    <div className="bg-muted/50 flex h-full min-h-0 flex-col overflow-y-auto px-5 py-6">
      <div className="mx-auto flex w-full max-w-lg flex-col gap-4">
        <div className="bg-card border-border rounded-xl border p-4 shadow-sm">
          <div className="mb-3 flex items-start justify-between gap-3">
            {canUpdate && editableLetterTypes.length > 0 ? (
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <FieldEditTrigger
                    label={t('pages.lawyerWorkplace.kanban.changeType', 'Change type')}
                  >
                    <KanbanTypeBadge
                      type={typeBadge.type}
                      label={typeBadge.label}
                      colorId={typeBadge.colorId}
                    />
                  </FieldEditTrigger>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className="max-h-60 min-w-[190px] overflow-y-auto p-1.5"
                >
                  <KanbanTypeMenuItems
                    task={task}
                    editableLetterTypes={editableLetterTypes}
                    onTaskUpdate={onTaskUpdate}
                  />
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <KanbanTypeBadge
                type={typeBadge.type}
                label={typeBadge.label}
                colorId={typeBadge.colorId}
              />
            )}
            <span className="text-muted-foreground text-[10px] font-medium tracking-wide">
              {task.id}
            </span>
          </div>
          <h2 className="text-foreground text-[15px] leading-snug font-semibold">{task.title}</h2>
        </div>

        <div className="bg-card border-border rounded-xl border p-4 shadow-sm">
          <dl className="grid gap-3 text-[13px]">
            <div className="flex flex-col gap-1">
              <dt className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
                {t('pages.lawyerWorkplace.kanban.statusLabel', 'Статус')}
              </dt>
              <dd className="flex flex-wrap items-center gap-2">
                {canMove ? (
                  <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                      <FieldEditTrigger label={t('pages.lawyerWorkplace.kanban.moveTo', 'Move to')}>
                        <span className="text-foreground text-[12px] font-medium">
                          {columnLabel}
                        </span>
                      </FieldEditTrigger>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="min-w-[160px] p-1.5">
                      <KanbanMoveToMenuItems task={task} onMoveTask={onMoveTask} />
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <span className="text-foreground text-[12px] font-medium">{columnLabel}</span>
                )}
                {canMove && task.columnId !== 'in_progress' ? (
                  <Button
                    type="button"
                    variant="primary"
                    size="xs"
                    onClick={() => onMoveTask?.(task.id, 'in_progress')}
                  >
                    <Icons.ArrowRight size={13} strokeWidth={1.8} />
                    {t('pages.lawyerWorkplace.kanban.startWork', 'Передати в роботу')}
                  </Button>
                ) : null}
              </dd>
            </div>

            <div className="flex flex-col gap-1">
              <dt className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
                {t('pages.lawyerWorkplace.parameters.client', 'Client')}
              </dt>
              <dd className="text-foreground flex min-w-0 items-center gap-1.5">
                {task.clientCode ? (
                  <>
                    <KanbanClientChip code={task.clientCode} />
                    {task.clientName ? (
                      <span className="text-muted-foreground truncate">{task.clientName}</span>
                    ) : null}
                  </>
                ) : (
                  <span className="text-muted-foreground italic">
                    {t('pages.lawyerWorkplace.letterItem.unidentified', 'unidentified')}
                  </span>
                )}
              </dd>
            </div>

            <div className="flex flex-col gap-1">
              <dt className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
                {t('pages.lawyerWorkplace.kanban.createTask.priority', 'Priority')}
              </dt>
              <dd>
                {canUpdate ? (
                  <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                      <FieldEditTrigger
                        label={t('pages.lawyerWorkplace.kanban.changePriority', 'Change priority')}
                      >
                        <KanbanPriorityOption priority={task.priority} />
                      </FieldEditTrigger>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="min-w-[160px] p-1.5">
                      <KanbanPriorityMenuItems task={task} onTaskUpdate={onTaskUpdate} />
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <KanbanPriorityOption priority={task.priority} />
                )}
              </dd>
            </div>

            <div className="flex flex-col gap-1">
              <dt className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
                {t('pages.lawyerWorkplace.parameters.dueDate', 'Due date')}
              </dt>
              <dd className="text-foreground">
                {canUpdate ? (
                  <DropdownMenu
                    modal={false}
                    open={deadlinePicker.open}
                    onOpenChange={deadlinePicker.handleOpenChange}
                  >
                    <DropdownMenuTrigger asChild>
                      <FieldEditTrigger
                        label={t('pages.lawyerWorkplace.kanban.setDeadline', 'Set deadline')}
                      >
                        <span className="flex items-center gap-1.5">
                          <Icons.Calendar
                            size={13}
                            strokeWidth={1.5}
                            className="text-muted-foreground shrink-0"
                          />
                          {deadlineText}
                        </span>
                      </FieldEditTrigger>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="bg-card p-2">
                      <KanbanDeadlineCalendar
                        selected={deadlinePicker.selected}
                        onChange={deadlinePicker.stage}
                      />
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  deadlineText
                )}
              </dd>
            </div>

            <div className="flex flex-col gap-1">
              <dt className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
                {t('pages.lawyerWorkplace.parameters.lawyer', 'Lawyer')}
              </dt>
              <dd>
                {canUpdate && lawyers.length > 0 ? (
                  <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                      <FieldEditTrigger
                        label={t('pages.lawyerWorkplace.kanban.changeAssignee', 'Change assignee')}
                      >
                        <KanbanAssigneeChip
                          initials={task.assigneeInitials}
                          name={task.assigneeName}
                          assigneeUserId={task.assigneeUserId}
                        />
                      </FieldEditTrigger>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="min-w-[170px] p-1.5">
                      <KanbanAssigneeMenuItems
                        task={task}
                        lawyers={lawyers}
                        onTaskUpdate={onTaskUpdate}
                      />
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <KanbanAssigneeChip
                    initials={task.assigneeInitials}
                    name={task.assigneeName}
                    assigneeUserId={task.assigneeUserId}
                  />
                )}
              </dd>
            </div>
          </dl>
        </div>

        <div className="border-warning-200 bg-warning-50 flex items-start gap-2.5 rounded-xl border px-4 py-3">
          <Icons.Info size={18} strokeWidth={1.5} className="text-warning-700 mt-0.5 shrink-0" />
          <p className="text-warning-900 text-[12px] leading-relaxed">
            {t(
              'pages.lawyerWorkplace.kanban.noEmailThread',
              'This task has no linked email thread. Details above come from the kanban task only.'
            )}
          </p>
        </div>
      </div>
    </div>
  )
}
