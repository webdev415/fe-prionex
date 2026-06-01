import type {
  CallMonitoringPeriod,
  TaskHistoryFilters,
  TaskHistorySort,
  TaskPriority,
  TaskStatus,
} from '@/features/training'
import { localDateStringsToIsoRange } from './dateRange'

const DEFAULT_PERIOD: CallMonitoringPeriod = 'last_7d'
const DEFAULT_SORT: TaskHistorySort = 'created_at_desc'

const TASK_HISTORY_SORTS: readonly TaskHistorySort[] = [
  'created_at_desc',
  'created_at_asc',
  'due_date_asc',
  'due_date_desc',
]
const TASK_PRIORITIES: readonly TaskPriority[] = ['low', 'normal', 'high', 'urgent', 'critical']
const TASK_STATUSES: readonly TaskStatus[] = [
  'pending',
  'in_progress',
  'completed',
  'cancelled',
  'extended',
  'rejected',
  'incoming_line_result',
]

/** Bar state for the Task History sub-tab.
 *
 * `period` + `customFromDate`/`customToDate` drive the top date-range picker
 * and always filter `created_at` (the Created date column).
 *
 * `dueFromDate`/`dueFromTime` + `dueToDate`/`dueToTime` are the two
 * separate filters under Status — they compose into one `due_date_from`/
 * `due_date_to` window on `Task.due_date`. Time inputs are optional and
 * default to `00:00` / `23:59:59.999` when only a date is set.
 *
 * `employeeIds` is the multi-select Assignee filter (renamed from
 * "Employee" in the UI but the URL key stays `employee_id` for back-compat).
 * `authorIds` is the multi-select Author filter, URL key `author_id`.
 */
export interface TaskHistoryBarState {
  period?: CallMonitoringPeriod
  customFromDate?: string
  customToDate?: string
  departmentId: number | null
  employeeIds: number[]
  authorIds: number[]
  groupId?: number
  subjectId?: number
  priority?: TaskPriority
  status?: TaskStatus
  dueFromDate?: string
  dueFromTime?: string
  dueToDate?: string
  dueToTime?: string
  sort: TaskHistorySort
}

export const TASK_HISTORY_FILTERS_DEFAULT: TaskHistoryBarState = {
  period: DEFAULT_PERIOD,
  customFromDate: undefined,
  customToDate: undefined,
  departmentId: null,
  employeeIds: [],
  authorIds: [],
  groupId: undefined,
  subjectId: undefined,
  priority: undefined,
  status: undefined,
  dueFromDate: undefined,
  dueFromTime: undefined,
  dueToDate: undefined,
  dueToTime: undefined,
  sort: DEFAULT_SORT,
}

function parsePositiveInt(value: string | null | undefined): number | undefined {
  if (value == null || value === '') return undefined
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : undefined
}

function parseEnum<T extends string>(value: string | null, allowed: readonly T[]): T | undefined {
  if (value == null) return undefined
  return (allowed as readonly string[]).includes(value) ? (value as T) : undefined
}

function parseYmd(value: string | null): string | undefined {
  if (value == null) return undefined
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined
}

function parseHm(value: string | null): string | undefined {
  if (value == null) return undefined
  return /^\d{2}:\d{2}$/.test(value) ? value : undefined
}

export function readTaskHistoryUrlState(params: URLSearchParams): TaskHistoryBarState {
  const period =
    parseEnum<CallMonitoringPeriod>(params.get('period'), [
      'today',
      'yesterday',
      'last_7d',
      'last_30d',
      'custom',
    ]) ?? DEFAULT_PERIOD

  const dept = parsePositiveInt(params.get('department_id'))
  const employeeIds = params
    .getAll('employee_id')
    .map((s) => Number(s))
    .filter((n) => Number.isFinite(n) && n > 0)
  const authorIds = params
    .getAll('author_id')
    .map((s) => Number(s))
    .filter((n) => Number.isFinite(n) && n > 0)

  return {
    period,
    customFromDate: params.get('from_date') ?? undefined,
    customToDate: params.get('to_date') ?? undefined,
    departmentId: dept != null ? dept : null,
    employeeIds,
    authorIds,
    groupId: parsePositiveInt(params.get('group_id')),
    subjectId: parsePositiveInt(params.get('subject_id')),
    priority: parseEnum<TaskPriority>(params.get('priority'), TASK_PRIORITIES),
    status: parseEnum<TaskStatus>(params.get('status'), TASK_STATUSES),
    dueFromDate: parseYmd(params.get('due_from_date')),
    dueFromTime: parseHm(params.get('due_from_time')),
    dueToDate: parseYmd(params.get('due_to_date')),
    dueToTime: parseHm(params.get('due_to_time')),
    sort: parseEnum<TaskHistorySort>(params.get('sort'), TASK_HISTORY_SORTS) ?? DEFAULT_SORT,
  }
}

export function writeTaskHistoryUrlState(
  base: URLSearchParams,
  state: TaskHistoryBarState
): URLSearchParams {
  const next = new URLSearchParams(base)
  next.delete('period')
  next.delete('from_date')
  next.delete('to_date')
  next.delete('department_id')
  next.delete('employee_id')
  next.delete('author_id')
  next.delete('group_id')
  next.delete('subject_id')
  next.delete('priority')
  next.delete('status')
  next.delete('due_from_date')
  next.delete('due_from_time')
  next.delete('due_to_date')
  next.delete('due_to_time')
  next.delete('sort')

  if (state.period && state.period !== DEFAULT_PERIOD) next.set('period', state.period)
  if (state.period === 'custom' && state.customFromDate && state.customToDate) {
    next.set('from_date', state.customFromDate)
    next.set('to_date', state.customToDate)
  }
  if (state.departmentId != null) {
    next.set('department_id', String(state.departmentId))
  } else {
    for (const id of state.employeeIds) {
      next.append('employee_id', String(id))
    }
  }
  for (const id of state.authorIds) {
    next.append('author_id', String(id))
  }
  if (state.groupId != null) next.set('group_id', String(state.groupId))
  if (state.subjectId != null) next.set('subject_id', String(state.subjectId))
  if (state.priority) next.set('priority', state.priority)
  if (state.status) next.set('status', state.status)
  if (state.dueFromDate) next.set('due_from_date', state.dueFromDate)
  if (state.dueFromTime) next.set('due_from_time', state.dueFromTime)
  if (state.dueToDate) next.set('due_to_date', state.dueToDate)
  if (state.dueToTime) next.set('due_to_time', state.dueToTime)
  if (state.sort && state.sort !== DEFAULT_SORT) next.set('sort', state.sort)
  return next
}

function resolveCreatedAtRange(state: TaskHistoryBarState): {
  date_from?: string
  date_to?: string
} {
  if (state.period === 'custom') {
    if (!state.customFromDate || !state.customToDate) return {}
    const r = localDateStringsToIsoRange(state.customFromDate, state.customToDate)
    return { date_from: r.from_datetime, date_to: r.to_datetime }
  }
  const now = new Date()
  if (state.period === 'today') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    return { date_from: start.toISOString(), date_to: now.toISOString() }
  }
  if (state.period === 'yesterday') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    return { date_from: start.toISOString(), date_to: end.toISOString() }
  }
  if (state.period === 'last_7d') {
    const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    return { date_from: start.toISOString(), date_to: now.toISOString() }
  }
  if (state.period === 'last_30d') {
    const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    return { date_from: start.toISOString(), date_to: now.toISOString() }
  }
  return {}
}

/**
 * Compose the two visible filters ("Due date" + "Due time") into one
 * `due_date_from` / `due_date_to` window expressed in the user's local
 * timezone, then converted to UTC ISO. If only dates are provided the
 * window snaps to the start/end of those days; if a date is missing on
 * either side, that side of the window is left open.
 */
function resolveDueDateRange(state: TaskHistoryBarState): {
  due_date_from?: string
  due_date_to?: string
} {
  const compose = (
    ymd: string | undefined,
    hm: string | undefined,
    side: 'from' | 'to'
  ): string | undefined => {
    if (!ymd) return undefined
    const [y, m, d] = ymd.split('-').map(Number)
    let hh = 0
    let mm = 0
    let ss = 0
    let ms = 0
    if (hm) {
      const [hhStr, mmStr] = hm.split(':')
      hh = Number(hhStr)
      mm = Number(mmStr)
    } else if (side === 'to') {
      hh = 23
      mm = 59
      ss = 59
      ms = 999
    }
    const dt = new Date(y, m - 1, d, hh, mm, ss, ms)
    if (isNaN(dt.getTime())) return undefined
    return dt.toISOString()
  }
  return {
    due_date_from: compose(state.dueFromDate, state.dueFromTime, 'from'),
    due_date_to: compose(state.dueToDate, state.dueToTime, 'to'),
  }
}

export function toTaskHistoryQuery(
  state: TaskHistoryBarState,
  assignedToUserIds: number[] | undefined,
  createdByIn: number[] | undefined
): TaskHistoryFilters {
  return {
    ...resolveCreatedAtRange(state),
    ...resolveDueDateRange(state),
    assigned_to_user_ids: assignedToUserIds,
    created_by_in: createdByIn,
    group_id: state.groupId,
    subject_id: state.subjectId,
    priority: state.priority,
    status: state.status,
    sort: state.sort,
  }
}

export function toTaskHistoryAnalyticsQuery(
  state: TaskHistoryBarState,
  assignedToUserIds: number[] | undefined,
  createdByIn: number[] | undefined
) {
  return {
    ...resolveCreatedAtRange(state),
    ...resolveDueDateRange(state),
    assigned_to_user_ids: assignedToUserIds,
    created_by_in: createdByIn,
    group_id: state.groupId,
    subject_id: state.subjectId,
    priority: state.priority,
    status: state.status,
  }
}
