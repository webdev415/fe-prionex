import type { OperatorUser } from '@/features/users/api/usersApi'
import type { CorrectionTask, CorrectionTaskStatus } from '@/features/training'
import type {
  MockTaskRow,
  TaskCategory,
  TaskKanbanColumn,
  TaskPriority,
  TaskStatus,
  TaskTimeBucket,
} from '../mocks/trainerWorkplaceMocks'
import i18n from '@/lib/i18n'
import { formatDate } from '@/lib/localeFormat'

/** Map BE correction status → the 4-column Kanban the Figma frame uses. */
export function statusToKanbanColumn(status: CorrectionTaskStatus): TaskKanbanColumn {
  switch (status) {
    case 'created':
    case 'notified':
    case 'read':
      return 'to_do'
    case 'in_progress':
      return 'in_progress'
    case 'returned_for_revision':
      // Returned tasks sit in the trainer-visible "planned" lane until
      // the operator resumes work — the visual signal matches the Figma
      // `ЗАПЛАНОВАНО` column tone.
      return 'planned'
    case 'completed':
    case 'confirmed':
      return 'done'
  }
}

/** Coarse status enum used by the existing chip styling. */
function deriveTaskStatus(status: CorrectionTaskStatus, isOverdue: boolean): TaskStatus {
  if (status === 'completed' || status === 'confirmed') return 'completed'
  if (isOverdue) return 'overdue'
  if (status === 'in_progress') return 'in_progress'
  return 'open'
}

/** Map BE priority to the FE pill enum. The FE has `critical` separately;
 *  task-service emits 'urgent' as the strongest signal, which we coerce
 *  to 'critical' so the red pill still lights up. */
function derivePriority(priority: string): TaskPriority {
  switch (priority) {
    case 'critical':
      return 'critical'
    case 'urgent':
      return 'critical'
    case 'high':
      return 'high'
    case 'low':
      return 'low'
    case 'normal':
    default:
      return 'medium'
  }
}

/** Pick an icon bucket from the task_type. */
function deriveCategory(taskType: string | null): TaskCategory {
  switch (taskType) {
    case 'listen_reflect':
      return 'listen'
    case 'practice_next_call':
      return 'assign_drill'
    case 'study_material':
      return 'prepare'
    case 'correction':
    default:
      return 'checklist'
  }
}

/** Today / Tomorrow / This week bucket from due_date. `all` falls
 *  through; tasks with no due_date land in `this_week` so the trainer
 *  still sees them under any of the filter chips. */
export function deriveTimeBucket(dueDateIso: string | null): TaskTimeBucket {
  if (!dueDateIso) return 'this_week'
  const due = new Date(dueDateIso)
  if (Number.isNaN(due.getTime())) return 'this_week'
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate())
  const diffDays = Math.round((dueDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays <= 0) return 'today'
  if (diffDays === 1) return 'tomorrow'
  return 'this_week'
}

const AVATAR_PALETTE = [
  '#FBCFE8',
  '#FED7AA',
  '#FEF3C7',
  '#D9F99D',
  '#A7F3D0',
  '#BAE6FD',
  '#C7D2FE',
  '#DDD6FE',
] as const

function avatarColorFor(operatorId: number | null | undefined): string {
  const id = operatorId ?? 0
  return AVATAR_PALETTE[Math.abs(id) % AVATAR_PALETTE.length]
}

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
}

function formatDateLabel(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return formatDate(d, i18n.language)
}

export function deriveTaskRow(task: CorrectionTask, operators: OperatorUser[]): MockTaskRow {
  const operator = operators.find((o) => o.id === task.operator_id)
  const operatorName = operator?.full_name ?? `#${task.operator_id ?? '—'}`
  const author = operators.find((o) => o.id === task.created_by)
  const authorName = author?.full_name ?? `#${task.created_by}`
  const kanbanColumn = statusToKanbanColumn(task.status)
  return {
    id: task.id,
    title: task.title,
    // `subtitle` is typed `string | undefined` on MockTaskRow — coerce null to undefined.
    subtitle: task.description ?? undefined,
    category: deriveCategory(task.task_type),
    priority: derivePriority(task.priority),
    status: deriveTaskStatus(task.status, task.is_overdue),
    kanbanColumn,
    executor: operatorName,
    author: authorName,
    assignmentScope: 'by_me',
    operatorInitials: initialsFor(operatorName),
    operatorAvatarColor: avatarColorFor(task.operator_id ?? null),
    dateLabel: formatDateLabel(task.due_date),
    cardTimestamp: formatDateLabel(task.due_date) || formatDateLabel(task.created_at),
    timeBucket: deriveTimeBucket(task.due_date),
    _correctionStatus: task.status,
  }
}

export function deriveTaskRows(tasks: CorrectionTask[], operators: OperatorUser[]): MockTaskRow[] {
  return tasks.map((t) => deriveTaskRow(t, operators))
}
