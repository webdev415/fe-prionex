import type {
  KanbanColumnId,
  KanbanTask,
  KanbanTaskPriority,
  KanbanTaskType,
} from '@/pages/LawyerWorkplace/kanban/kanbanData'
import type { DeadlineFilter } from '@/pages/LawyerWorkplace/components/kanban/constants'
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
  clientId?: number | null
  clientName?: string | null
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

function overdueDueDateIso(): string {
  const date = new Date()
  date.setDate(date.getDate() - 1)
  date.setHours(12, 0, 0, 0)
  return date.toISOString()
}

export function mapKanbanPatchToTaskUpdate(
  patch: LegalKanbanTaskPatch,
  task: KanbanTask
): Record<string, unknown> {
  const payload: Record<string, unknown> = {}

  if (patch.priority) {
    payload.priority = KANBAN_PRIORITY_TO_TASK[patch.priority] ?? 'normal'
  }

  if (patch.assigneeUserId !== undefined) {
    payload.assigned_to_user_id = patch.assigneeUserId
  }

  if (patch.deadline !== undefined) {
    payload.due_date = patch.deadline
  }

  if (patch.columnId) {
    payload.status = mapKanbanColumnToTaskStatus(patch.columnId)
    if (patch.columnId === 'overdue' && patch.deadline === undefined) {
      const currentDue = task.deadline ? new Date(task.deadline) : null
      if (!currentDue || currentDue.getTime() > Date.now()) {
        payload.due_date = overdueDueDateIso()
      }
    }
  }

  return payload
}

export function applyKanbanTaskPatch(
  task: KanbanTask,
  patch: LegalKanbanTaskPatch,
  lawyers: LegalLawyer[] = []
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
      if (!currentDue || currentDue.getTime() > Date.now()) {
        next.deadline = overdueDueDateIso()
      }
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

function resolveKanbanColumn(item: LegalKanbanTaskItem, taskType: KanbanTaskType): KanbanColumnId {
  if (item.status === 'completed' || item.status === 'cancelled') {
    return 'completed'
  }
  if (taskType === 'unclassified' || taskType === 'type_pending') {
    return 'not_defined'
  }
  if (item.is_overdue) {
    return 'overdue'
  }
  return 'in_progress'
}

export function mapLegalKanbanItemToTask(
  item: LegalKanbanTaskItem,
  lawyers: LegalLawyer[]
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
    columnId: resolveKanbanColumn(item, taskType),
    letterId: item.message_id,
  }
}

function startOfDay(date: Date): Date {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

function endOfWeek(date: Date): Date {
  const next = startOfDay(date)
  const day = next.getDay()
  const mondayOffset = day === 0 ? -6 : 1 - day
  next.setDate(next.getDate() + mondayOffset + 6)
  next.setHours(23, 59, 59, 999)
  return next
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999)
}

export function matchesDeadlineFilter(task: KanbanTask, filter: DeadlineFilter): boolean {
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

  const now = new Date()
  if (filter === 'this_week') {
    return due >= startOfDay(now) && due <= endOfWeek(now)
  }

  return due >= startOfDay(now) && due <= endOfMonth(now)
}

export function mapLegalKanbanItems(
  items: LegalKanbanTaskItem[],
  lawyers: LegalLawyer[]
): KanbanTask[] {
  return items.map((item) => mapLegalKanbanItemToTask(item, lawyers))
}
