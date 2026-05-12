import type {
  CallMonitoringPeriod,
  TaskHistoryDateType,
  TaskHistoryFilters,
  TaskHistorySort,
  TaskPriority,
  TaskStatus,
} from '@/features/actionAnalysis'
import { localDateStringsToIsoRange } from './dateRange'

const DEFAULT_PERIOD: CallMonitoringPeriod = 'last_7d'
const DEFAULT_DATE_TYPE: TaskHistoryDateType = 'created'
const DEFAULT_SORT: TaskHistorySort = 'created_at_desc'

const TASK_HISTORY_DATE_TYPES: readonly TaskHistoryDateType[] = ['created', 'due']
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

export interface TaskHistoryBarState {
  period?: CallMonitoringPeriod
  customFromDate?: string
  customToDate?: string
  dateType: TaskHistoryDateType
  departmentId: number | null
  employeeIds: number[]
  groupId?: number
  subjectId?: number
  priority?: TaskPriority
  status?: TaskStatus
  sort: TaskHistorySort
}

export const TASK_HISTORY_FILTERS_DEFAULT: TaskHistoryBarState = {
  period: DEFAULT_PERIOD,
  customFromDate: undefined,
  customToDate: undefined,
  dateType: DEFAULT_DATE_TYPE,
  departmentId: null,
  employeeIds: [],
  groupId: undefined,
  subjectId: undefined,
  priority: undefined,
  status: undefined,
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

  return {
    period,
    customFromDate: params.get('from_date') ?? undefined,
    customToDate: params.get('to_date') ?? undefined,
    dateType:
      parseEnum<TaskHistoryDateType>(params.get('date_type'), TASK_HISTORY_DATE_TYPES) ??
      DEFAULT_DATE_TYPE,
    departmentId: dept != null ? dept : null,
    employeeIds,
    groupId: parsePositiveInt(params.get('group_id')),
    subjectId: parsePositiveInt(params.get('subject_id')),
    priority: parseEnum<TaskPriority>(params.get('priority'), TASK_PRIORITIES),
    status: parseEnum<TaskStatus>(params.get('status'), TASK_STATUSES),
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
  next.delete('date_type')
  next.delete('department_id')
  next.delete('employee_id')
  next.delete('group_id')
  next.delete('subject_id')
  next.delete('priority')
  next.delete('status')
  next.delete('sort')

  if (state.period && state.period !== DEFAULT_PERIOD) next.set('period', state.period)
  if (state.period === 'custom' && state.customFromDate && state.customToDate) {
    next.set('from_date', state.customFromDate)
    next.set('to_date', state.customToDate)
  }
  if (state.dateType && state.dateType !== DEFAULT_DATE_TYPE) {
    next.set('date_type', state.dateType)
  }
  if (state.departmentId != null) {
    next.set('department_id', String(state.departmentId))
  } else {
    for (const id of state.employeeIds) {
      next.append('employee_id', String(id))
    }
  }
  if (state.groupId != null) next.set('group_id', String(state.groupId))
  if (state.subjectId != null) next.set('subject_id', String(state.subjectId))
  if (state.priority) next.set('priority', state.priority)
  if (state.status) next.set('status', state.status)
  if (state.sort && state.sort !== DEFAULT_SORT) next.set('sort', state.sort)
  return next
}

function resolveDateRange(state: TaskHistoryBarState): {
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

export function toTaskHistoryQuery(
  state: TaskHistoryBarState,
  assignedToUserIds: number[] | undefined
): TaskHistoryFilters {
  const range = resolveDateRange(state)
  return {
    ...range,
    date_type: state.dateType,
    assigned_to_user_ids: assignedToUserIds,
    group_id: state.groupId,
    subject_id: state.subjectId,
    priority: state.priority,
    status: state.status,
    sort: state.sort,
  }
}

export function toTaskHistoryAnalyticsQuery(
  state: TaskHistoryBarState,
  assignedToUserIds: number[] | undefined
) {
  const range = resolveDateRange(state)
  return {
    ...range,
    assigned_to_user_ids: assignedToUserIds,
    group_id: state.groupId,
    subject_id: state.subjectId,
    priority: state.priority,
    status: state.status,
  }
}
