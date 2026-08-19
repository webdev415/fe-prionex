import type { TFunction } from 'i18next'
import { downloadBlob } from '@/features/messaging/utils/downloadBlob'
import { legalDueCalendarDay } from '@/features/lawyerWorkplace/utils/legalDueDate'
import {
  findKanbanLetterType,
  TYPE_I18N_KEYS,
  TYPE_SHORT_LABELS,
  type KanbanLetterTypeRef,
} from '../components/kanban/constants'
import type { KanbanColumnDef, KanbanTask, KanbanTaskType } from './kanbanData'

function escapeCsvCell(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function formatIsoDate(iso: string | null, timezone?: string | null): string {
  if (!iso) return ''
  return legalDueCalendarDay(iso, timezone) || iso
}

function taskTypeLabel(task: KanbanTask, t: TFunction, letterTypes: KanbanLetterTypeRef[]): string {
  const letterType = findKanbanLetterType(letterTypes, task.letterTypeId)
  if (letterType?.name) return letterType.name
  return t(TYPE_I18N_KEYS[task.type as KanbanTaskType], TYPE_SHORT_LABELS[task.type])
}

/** Export visible kanban columns (after filters) to CSV. */
export function exportKanbanTasksToCsv(
  columns: KanbanColumnDef[],
  t: TFunction,
  filename?: string,
  letterTypes: KanbanLetterTypeRef[] = [],
  timezone?: string | null
): number {
  const rows = columns.flatMap((column) =>
    column.tasks.map((task) => ({
      column: t(column.labelKey, column.id),
      task_id: String(task.taskId),
      type: taskTypeLabel(task, t, letterTypes),
      title: task.title,
      client_code: task.clientCode ?? '',
      client_name: task.clientName ?? '',
      deadline: formatIsoDate(task.deadline, timezone),
      closed_at: formatIsoDate(task.closedAt, timezone),
      priority: task.priority,
      assignee: task.assigneeName,
      assignee_initials: task.assigneeInitials,
      letter_id: task.letterId ?? '',
    }))
  )

  if (rows.length === 0) return 0

  const headers = [
    'column',
    'task_id',
    'type',
    'title',
    'client_code',
    'client_name',
    'deadline',
    'closed_at',
    'priority',
    'assignee',
    'assignee_initials',
    'letter_id',
  ]

  const csv = [
    headers.join(','),
    ...rows.map((row) =>
      headers.map((header) => escapeCsvCell(row[header as keyof typeof row])).join(',')
    ),
  ].join('\n')

  const exportFilename =
    filename ?? `legal-kanban-tasks-${new Date().toISOString().slice(0, 10)}.csv`

  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), exportFilename)
  return rows.length
}
