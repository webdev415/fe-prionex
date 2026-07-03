// ─── Types ───────────────────────────────────────────────────────────────────

export type KanbanColumnId = 'not_defined' | 'in_progress' | 'overdue' | 'completed'

export type KanbanTaskType =
  | 'unclassified'
  | 'type_pending'
  | 'complaint'
  | 'nbu_inquiry'
  | 'court_claim'
  | 'attorney_request'
  | 'inquiry'

export type KanbanTaskPriority = 'highest' | 'high' | 'medium' | 'low' | 'lowest'

export interface KanbanTask {
  id: string
  taskId: number
  type: KanbanTaskType
  title: string
  clientCode: string | null
  clientName: string | null
  /** ISO date: when the task response is / was due */
  deadline: string | null
  /** ISO date: when the task was closed (COMPLETED column) */
  closedAt: string | null
  priority: KanbanTaskPriority
  /** Two-letter initials, e.g. "VD" */
  assigneeInitials: string
  /** Display name after initials, e.g. "Doroshenko" */
  assigneeName: string
  assigneeUserId: number | null
  columnId: KanbanColumnId
  /** Source email message id (links card → thread drawer) */
  letterId: string | null
}

export interface KanbanColumnDef {
  id: KanbanColumnId
  /** i18n key */
  labelKey: string
  dotClass: string
  tasks: KanbanTask[]
  /** Count of tasks completed/added today (shown as "4 · today") */
  todayCount?: number
}

export const KANBAN_DRAG_MIME = 'application/x-legal-kanban-task'

export interface KanbanDragPayload {
  taskId: string
  fromColumnId: KanbanColumnId
}

const KANBAN_COLUMN_META: Pick<KanbanColumnDef, 'id' | 'labelKey' | 'dotClass'>[] = [
  {
    id: 'not_defined',
    labelKey: 'pages.lawyerWorkplace.kanban.columns.notDefined',
    dotClass: 'bg-gray-600',
  },
  {
    id: 'in_progress',
    labelKey: 'pages.lawyerWorkplace.kanban.columns.inProgress',
    dotClass: 'bg-information-500',
  },
  {
    id: 'overdue',
    labelKey: 'pages.lawyerWorkplace.kanban.columns.overdue',
    dotClass: 'bg-error-500',
  },
  {
    id: 'completed',
    labelKey: 'pages.lawyerWorkplace.kanban.columns.completed',
    dotClass: 'bg-success-500',
  },
]

function isClosedToday(closedAt: string | null): boolean {
  if (!closedAt) return false
  const closed = new Date(closedAt)
  const now = new Date()
  return (
    closed.getFullYear() === now.getFullYear() &&
    closed.getMonth() === now.getMonth() &&
    closed.getDate() === now.getDate()
  )
}

/** Build column defs from a flat task list (used by the live board state). */
export function buildKanbanColumns(tasks: KanbanTask[]): KanbanColumnDef[] {
  const completedToday = tasks.filter(
    (task) => task.columnId === 'completed' && isClosedToday(task.closedAt)
  ).length

  return KANBAN_COLUMN_META.map((meta) => ({
    ...meta,
    tasks: tasks.filter((task) => task.columnId === meta.id),
    ...(meta.id === 'completed' && completedToday > 0 ? { todayCount: completedToday } : {}),
  }))
}

/** Move a task to another column, updating closedAt when entering/leaving DONE. */
export function moveKanbanTask(
  tasks: KanbanTask[],
  taskId: string,
  toColumnId: KanbanColumnId
): KanbanTask[] {
  return tasks.map((task) => {
    if (task.id !== taskId || task.columnId === toColumnId) return task

    const now = new Date().toISOString()
    return {
      ...task,
      columnId: toColumnId,
      closedAt: toColumnId === 'completed' ? (task.closedAt ?? now) : null,
    }
  })
}
