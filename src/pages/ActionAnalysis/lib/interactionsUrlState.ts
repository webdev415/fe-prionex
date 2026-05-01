import type {
  InteractionMonitoringFilters,
  InteractionMonitoringSortBy,
  InteractionMonitoringSortDir,
  CallMonitoringPeriod,
} from '@/features/actionAnalysis'
import type { OperatorUser } from '@/features/users/api/usersApi'
import { localDateStringsToIsoRange } from './dateRange'

const DEFAULT_PERIOD: CallMonitoringPeriod = 'last_7d'
const DEFAULT_SORT_BY: InteractionMonitoringSortBy = 'date'
const DEFAULT_SORT_DIR: InteractionMonitoringSortDir = 'desc'

export interface InteractionBarState {
  period?: CallMonitoringPeriod
  customFromDate?: string
  customToDate?: string
  departmentId: number | null
  employeeIds: number[]
  result_ids?: number[]
  contact_type_ids?: number[]
  promise_amount_min?: number
  promise_amount_max?: number
  sort_by?: InteractionMonitoringSortBy
  sort_dir?: InteractionMonitoringSortDir
}

export function readInteractionBarState(params: URLSearchParams): InteractionBarState {
  const period = (params.get('period') as CallMonitoringPeriod | null) ?? DEFAULT_PERIOD
  const resultId = params.get('result_id')
  const contactTypeId = params.get('contact_type_id')
  const promiseMin = params.get('promise_min')
  const promiseMax = params.get('promise_max')
  const sortBy = (params.get('sort_by') as InteractionMonitoringSortBy | null) ?? DEFAULT_SORT_BY
  const sortDir =
    (params.get('sort_dir') as InteractionMonitoringSortDir | null) ?? DEFAULT_SORT_DIR
  const dept = params.get('department_id')
  const employeeIds = params
    .getAll('employee_id')
    .map((s) => Number(s))
    .filter((n) => Number.isFinite(n) && n > 0)

  return {
    period,
    customFromDate: params.get('from_date') ?? undefined,
    customToDate: params.get('to_date') ?? undefined,
    departmentId: dept ? Number(dept) : null,
    employeeIds,
    result_ids: resultId ? [Number(resultId)] : undefined,
    contact_type_ids: contactTypeId ? [Number(contactTypeId)] : undefined,
    promise_amount_min: promiseMin ? Number(promiseMin) : undefined,
    promise_amount_max: promiseMax ? Number(promiseMax) : undefined,
    sort_by: sortBy,
    sort_dir: sortDir,
  }
}

export function writeInteractionBarState(
  base: URLSearchParams,
  state: InteractionBarState
): URLSearchParams {
  const next = new URLSearchParams(base)
  next.delete('department_id')
  next.delete('employee_id')
  next.delete('period')
  next.delete('result_id')
  next.delete('contact_type_id')
  next.delete('promise_min')
  next.delete('promise_max')
  next.delete('sort_by')
  next.delete('sort_dir')
  next.delete('from_date')
  next.delete('to_date')

  if (state.departmentId != null) {
    next.set('department_id', String(state.departmentId))
  } else {
    for (const id of state.employeeIds) {
      next.append('employee_id', String(id))
    }
  }

  if (state.period && state.period !== DEFAULT_PERIOD) next.set('period', state.period)
  const resultId = state.result_ids?.[0]
  if (resultId) next.set('result_id', String(resultId))
  const contactTypeId = state.contact_type_ids?.[0]
  if (contactTypeId) next.set('contact_type_id', String(contactTypeId))
  if (state.promise_amount_min != null) next.set('promise_min', String(state.promise_amount_min))
  if (state.promise_amount_max != null) next.set('promise_max', String(state.promise_amount_max))
  if (state.sort_by && state.sort_by !== DEFAULT_SORT_BY) next.set('sort_by', state.sort_by)
  if (state.sort_dir && state.sort_dir !== DEFAULT_SORT_DIR) next.set('sort_dir', state.sort_dir)
  if (state.period === 'custom' && state.customFromDate && state.customToDate) {
    next.set('from_date', state.customFromDate)
    next.set('to_date', state.customToDate)
  }
  return next
}

export type ResolvedInteractionUsers =
  | { kind: 'all' }
  | { kind: 'ids'; ids: number[] }
  | { kind: 'empty' }

export function resolveInteractionUsers(
  state: InteractionBarState,
  operators: OperatorUser[]
): ResolvedInteractionUsers {
  if (state.departmentId != null) {
    const ids = operators.filter((o) => o.department_id === state.departmentId).map((o) => o.id)
    return ids.length ? { kind: 'ids', ids } : { kind: 'empty' }
  }
  if (state.employeeIds.length > 0) return { kind: 'ids', ids: state.employeeIds }
  return { kind: 'all' }
}

export function toInteractionMonitoringQuery(
  state: InteractionBarState,
  operators: OperatorUser[]
): InteractionMonitoringFilters {
  const resolved = resolveInteractionUsers(state, operators)
  const user_ids = resolved.kind === 'ids' ? resolved.ids : undefined

  let from_datetime: string | undefined
  let to_datetime: string | undefined
  if (state.period === 'custom' && state.customFromDate && state.customToDate) {
    const r = localDateStringsToIsoRange(state.customFromDate, state.customToDate)
    from_datetime = r.from_datetime
    to_datetime = r.to_datetime
  }

  return {
    period: state.period,
    result_ids: state.result_ids,
    contact_type_ids: state.contact_type_ids,
    promise_amount_min: state.promise_amount_min,
    promise_amount_max: state.promise_amount_max,
    sort_by: state.sort_by,
    sort_dir: state.sort_dir,
    user_ids,
    from_datetime,
    to_datetime,
  }
}
