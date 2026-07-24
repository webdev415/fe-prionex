import type {
  KanbanColumnId,
  KanbanTask,
  KanbanTaskPriority,
  KanbanTaskType,
} from '@/pages/LawyerWorkplace/kanban/kanbanData'
import type { DeadlineFilter } from '@/pages/LawyerWorkplace/components/kanban/constants'
import {
  isLegalDueDateOverdue,
  legalDefaultDueDateIso,
  legalOverdueDueDateIso,
  resolveLegalTimezone,
} from '../utils/legalDueDate'
import type { LegalKanbanTaskItem, LegalLawyer } from './types'

const KNOWN_TYPES = new Set<KanbanTaskType>([
  'complaint',
  'nbu_inquiry',
  'court_claim',
  'attorney_request',
  'inquiry',
])

const TASK_PRIORITY_TO_KANBAN: Record<string, KanbanTaskPriority> = {
  urgent: 'highest',
  critical: 'highest',
  high: 'high',
  normal: 'medium',
  low: 'low',
}

export const KANBAN_PRIORITY_TO_TASK: Record<KanbanTaskPriority, string> = {
  highest: 'urgent',
  high: 'high',
  medium: 'normal',
  low: 'low',
  lowest: 'low',
}

export type LegalKanbanTaskPatch = {
  columnId?: KanbanColumnId
  priority?: KanbanTaskPriority
  assigneeUserId?: number | null
  deadline?: string | null
  letterTypeId?: string
  clearLetterType?: boolean
  clientId?: number | null
  clientName?: string | null
}

export function buildKanbanColumnMovePatch(
  task: KanbanTask,
  targetColumnId: KanbanColumnId,
  timezone?: string | null
): LegalKanbanTaskPatch {
  const patch: LegalKanbanTaskPatch = { columnId: targetColumnId }

  if (targetColumnId === 'overdue') {
    if (!task.deadline || !isLegalDueDateOverdue(task.deadline, timezone)) {
      patch.deadline = legalOverdueDueDateIso(timezone)
    }
  } else if (targetColumnId === 'in_progress') {
    if (!task.deadline || isLegalDueDateOverdue(task.deadline, timezone)) {
      patch.deadline = legalDefaultDueDateIso(timezone)
    }
  } else if (targetColumnId === 'not_defined') {
    patch.clearLetterType = true
  }

  return patch
}

export function mapKanbanColumnToTaskStatus(columnId: KanbanColumnId): string {
  switch (columnId) {
    case 'completed':
      return 'completed'
    case 'in_progress':
    case 'overdue':
      return 'in_progress'
    default:
      return 'pending'
  }
}

function overdueDueDateIso(timezone?: string | null): string {
  return legalOverdueDueDateIso(timezone)
}

export function mapKanbanPatchToTaskUpdate(
  patch: LegalKanbanTaskPatch,
  task: KanbanTask,
  timezone?: string | null
): Record<string, unknown> {
  const payload: Record<string, unknown> = {}

  if (patch.priority) {
    payload.priority = KANBAN_PRIORITY_TO_TASK[patch.priority] ?? 'normal'
  }

  if (patch.columnId) {
    payload.status = mapKanbanColumnToTaskStatus(patch.columnId)
    if (patch.columnId === 'overdue' && patch.deadline === undefined) {
      if (!task.deadline || !isLegalDueDateOverdue(task.deadline, timezone)) {
        payload.due_date = overdueDueDateIso(timezone)
      }
    }
    if (patch.columnId === 'in_progress' && patch.deadline === undefined) {
      if (!task.deadline || isLegalDueDateOverdue(task.deadline, timezone)) {
        payload.due_date = legalDefaultDueDateIso(timezone)
      }
    }
  }

  return payload
}

export function mapKanbanPatchToMetadataPayload(
  patch: LegalKanbanTaskPatch
): Record<string, unknown> {
  const payload: Record<string, unknown> = {}

  if (patch.letterTypeId) {
    payload.letter_type_id = patch.letterTypeId
  }

  if (patch.clientId !== undefined) {
    payload.client_id = patch.clientId
  }

  if (patch.assigneeUserId !== undefined) {
    payload.assigned_to_user_id = patch.assigneeUserId
  }

  if (patch.deadline !== undefined) {
    payload.due_date = patch.deadline
  }

  return payload
}

export function applyKanbanTaskPatch(
  task: KanbanTask,
  patch: LegalKanbanTaskPatch,
  lawyers: LegalLawyer[] = [],
  timezone?: string | null
): KanbanTask {
  let next: KanbanTask = { ...task }

  if (patch.columnId) {
    const now = new Date().toISOString()
    next = {
      ...next,
      columnId: patch.columnId,
      closedAt: patch.columnId === 'completed' ? (task.closedAt ?? now) : null,
    }
    if (patch.columnId === 'overdue' && patch.deadline === undefined) {
      const currentDue = task.deadline ? new Date(task.deadline) : null
      if (!currentDue || !isLegalDueDateOverdue(task.deadline, timezone)) {
        next.deadline = legalOverdueDueDateIso(timezone)
      }
    }
    if (patch.columnId === 'in_progress' && patch.deadline === undefined) {
      if (!task.deadline || isLegalDueDateOverdue(task.deadline, timezone)) {
        next.deadline = legalDefaultDueDateIso(timezone)
      }
    }
    if (patch.columnId === 'not_defined' || patch.clearLetterType) {
      next.type = 'unclassified'
      next.letterTypeId = null
    }
  }

  if (patch.priority) {
    next.priority = patch.priority
  }

  if (patch.assigneeUserId !== undefined) {
    next.assigneeUserId = patch.assigneeUserId
    const lawyer = lawyers.find((item) => item.user_id === patch.assigneeUserId)
    if (lawyer) {
      next.assigneeInitials = lawyer.initials
      next.assigneeName = extractAssigneeName(lawyer.display_name)
    }
  }

  if (patch.deadline !== undefined) {
    next.deadline = patch.deadline
  }

  if (patch.letterTypeId) {
    next.type = resolveTaskType(patch.letterTypeId)
    next.letterTypeId = patch.letterTypeId
  }

  if (patch.clearLetterType) {
    next.type = 'unclassified'
    next.letterTypeId = null
  }

  if (patch.clientId !== undefined) {
    next.clientCode = formatClientCode(patch.clientId)
    next.clientName = patch.clientName ?? null
  }

  return next
}

function formatClientCode(clientId: number | null | undefined): string | null {
  if (clientId == null || clientId <= 0) return null
  return `CL-${String(clientId).padStart(5, '0')}`
}

function extractAssigneeName(displayName: string | null | undefined): string {
  if (!displayName?.trim()) return '—'
  const parts = displayName.trim().split(/\s+/)
  return parts[parts.length - 1] ?? displayName
}

function resolveLawyerMeta(
  lawyers: LegalLawyer[],
  assignedToUserId: number | null | undefined,
  assignedToUsername: string | null | undefined
): { initials: string; name: string } {
  const lawyer = lawyers.find((item) => item.user_id === assignedToUserId)
  if (lawyer) {
    return {
      initials: lawyer.initials,
      name: extractAssigneeName(lawyer.display_name),
    }
  }

  const fallbackName = extractAssigneeName(assignedToUsername)
  const initials = fallbackName
    .split(/\s+/)
    .map((part) => part[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase()
  return { initials: initials || '—', name: fallbackName }
}

function resolveTaskType(letterTypeId: string | null | undefined): KanbanTaskType {
  if (!letterTypeId) return 'unclassified'
  if (KNOWN_TYPES.has(letterTypeId as KanbanTaskType)) {
    return letterTypeId as KanbanTaskType
  }
  return 'type_pending'
}

function resolveKanbanColumn(
  item: LegalKanbanTaskItem,
  taskType: KanbanTaskType,
  timezone?: string | null
): KanbanColumnId {
  if (item.status === 'completed' || item.status === 'cancelled') {
    return 'completed'
  }
  if (taskType === 'unclassified' || taskType === 'type_pending') {
    return 'not_defined'
  }
  if (item.is_overdue || isLegalDueDateOverdue(item.due_date, timezone)) {
    return 'overdue'
  }
  return 'in_progress'
}

export function mapLegalKanbanItemToTask(
  item: LegalKanbanTaskItem,
  lawyers: LegalLawyer[],
  timezone?: string | null
): KanbanTask {
  const taskType = resolveTaskType(item.letter_type_id)
  const assignee = resolveLawyerMeta(lawyers, item.assigned_to_user_id, item.assigned_to_username)

  return {
    id: `TASK-${item.task_id}`,
    taskId: item.task_id,
    type: taskType,
    title: item.title,
    clientCode: formatClientCode(item.client_id),
    clientName: item.client_name,
    deadline: item.due_date,
    closedAt: item.completed_at ?? (item.status === 'completed' ? item.updated_at : null),
    priority: TASK_PRIORITY_TO_KANBAN[item.priority] ?? 'medium',
    assigneeInitials: assignee.initials,
    assigneeName: assignee.name,
    assigneeUserId: item.assigned_to_user_id ?? null,
    columnId: resolveKanbanColumn(item, taskType, timezone),
    letterId: item.message_id,
    letterTypeId: item.letter_type_id ?? null,
    legalTaskId: item.task_id,
    letterCount: item.letter_count != null && item.letter_count > 0 ? item.letter_count : 1,
  }
}

export function matchesDeadlineFilter(
  task: KanbanTask,
  filter: DeadlineFilter,
  timezone?: string | null
): boolean {
  if (filter === 'all') {
    return true
  }
  if (task.columnId === 'overdue' || task.columnId === 'completed') {
    return true
  }
  if (!task.deadline) {
    return false
  }

  const due = new Date(task.deadline)
  if (Number.isNaN(due.getTime())) {
    return false
  }

  const tz = resolveLegalTimezone(timezone)
  const formatDay = (value: Date) =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(value)

  const dueKey = formatDay(due)
  const nowKey = formatDay(new Date())
  const [ny, nm, nd] = nowKey.split('-').map(Number)
  const [dy, dm, dd] = dueKey.split('-').map(Number)
  const nowDay = Date.UTC(ny, nm - 1, nd)
  const dueDay = Date.UTC(dy, dm - 1, dd)

  if (filter === 'this_week') {
    const nowDate = new Date(nowDay)
    const day = nowDate.getUTCDay()
    const mondayOffset = day === 0 ? -6 : 1 - day
    const weekStart = nowDay + mondayOffset * 86_400_000
    const weekEnd = weekStart + 6 * 86_400_000
    return dueDay >= weekStart && dueDay <= weekEnd
  }

  const monthEnd = Date.UTC(ny, nm, 0)
  return dueDay >= nowDay && dueDay <= monthEnd
}

export function mapLegalKanbanItems(
  items: LegalKanbanTaskItem[],
  lawyers: LegalLawyer[],
  timezone?: string | null
): KanbanTask[] {
  return items.map((item) => mapLegalKanbanItemToTask(item, lawyers, timezone))
}
