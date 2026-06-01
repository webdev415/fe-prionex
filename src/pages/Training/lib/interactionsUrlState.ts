import type {
  InteractionInternalDateType,
  InteractionMonitoringFilters,
  InteractionMonitoringSortBy,
  InteractionMonitoringSortDir,
  CallMonitoringPeriod,
} from '@/features/training'
import type { OperatorUser } from '@/features/users/api/usersApi'
import { localDateStringsToIsoRange } from './dateRange'

const DEFAULT_PERIOD: CallMonitoringPeriod = 'last_7d'
const DEFAULT_SORT_BY: InteractionMonitoringSortBy = 'date'
const DEFAULT_SORT_DIR: InteractionMonitoringSortDir = 'desc'

const INTERNAL_DATE_TYPES: InteractionInternalDateType[] = [
  'promise_to_pay',
  'next_action',
  'follow_up',
  'any',
]

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
  // KAN-409 follow-up: internal-date filter (one combined filter; the date
  // type chooses which column on the row to compare). Bounds are stored as
  // local YYYY-MM-DD strings so they round-trip cleanly through the URL.
  internal_date_type?: InteractionInternalDateType
  internal_date_from?: string
  internal_date_to?: string
  channel?: string
  sort_by?: InteractionMonitoringSortBy
  sort_dir?: InteractionMonitoringSortDir
}

export const INTERACTION_FILTERS_DEFAULT: InteractionBarState = {
  period: DEFAULT_PERIOD,
  customFromDate: undefined,
  customToDate: undefined,
  departmentId: null,
  employeeIds: [],
  result_ids: undefined,
  contact_type_ids: undefined,
  promise_amount_min: undefined,
  promise_amount_max: undefined,
  internal_date_type: undefined,
  internal_date_from: undefined,
  internal_date_to: undefined,
  channel: undefined,
  sort_by: DEFAULT_SORT_BY,
  sort_dir: DEFAULT_SORT_DIR,
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

  const rawInternalType = params.get('internal_date_type')
  const internalDateType = (INTERNAL_DATE_TYPES as readonly string[]).includes(
    rawInternalType ?? ''
  )
    ? (rawInternalType as InteractionInternalDateType)
    : undefined
  const channelParam = params.get('channel')

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
    internal_date_type: internalDateType,
    internal_date_from: params.get('internal_from') ?? undefined,
    internal_date_to: params.get('internal_to') ?? undefined,
    channel: channelParam || undefined,
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
  next.delete('internal_date_type')
  next.delete('internal_from')
  next.delete('internal_to')
  next.delete('channel')

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
  if (state.internal_date_type) next.set('internal_date_type', state.internal_date_type)
  if (state.internal_date_from) next.set('internal_from', state.internal_date_from)
  if (state.internal_date_to) next.set('internal_to', state.internal_date_to)
  if (state.channel) next.set('channel', state.channel)
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

/**
 * Resolve effective user_ids[] for the interaction-monitoring query.
 *
 * `scopedUserIds` (KAN-506) is the result of the page-level Scope selector:
 *   - `undefined` â†’ no scope filter (scope=all or scope=group placeholder),
 *   - `[]`        â†’ scope locked to a context with zero matching users
 *                   (e.g. scope=department but the dept has no operators),
 *   - `number[]`  â†’ effective scope.
 *
 * Tab-level Department / Employee pickers refine within the scope. When the
 * intersection is empty AND scope was non-empty, we return `empty` so the UI
 * renders the no-data state instead of issuing a wide query.
 */
export function resolveInteractionUsers(
  state: InteractionBarState,
  operators: OperatorUser[],
  scopedUserIds?: number[] | undefined
): ResolvedInteractionUsers {
  // 1. Tab-level Department picker â€” local refinement.
  let localIds: number[] | 'none' | 'all' = 'all'
  if (state.departmentId != null) {
    const ids = operators.filter((o) => o.department_id === state.departmentId).map((o) => o.id)
    localIds = ids.length ? ids : 'none'
  } else if (state.employeeIds.length > 0) {
    localIds = state.employeeIds
  }

  // 2. Apply the page-level scope as an intersecting filter.
  //    `undefined` â†’ no scope; pass `localIds` through.
  if (scopedUserIds === undefined) {
    if (localIds === 'all') return { kind: 'all' }
    if (localIds === 'none') return { kind: 'empty' }
    return { kind: 'ids', ids: localIds }
  }
  // Scope is set but empty (e.g. scope=department with no operators).
  if (scopedUserIds.length === 0) return { kind: 'empty' }

  if (localIds === 'all') return { kind: 'ids', ids: scopedUserIds }
  if (localIds === 'none') return { kind: 'empty' }
  const scopeSet = new Set(scopedUserIds)
  const intersected = localIds.filter((id) => scopeSet.has(id))
  return intersected.length ? { kind: 'ids', ids: intersected } : { kind: 'empty' }
}

export function toInteractionMonitoringQuery(
  state: InteractionBarState,
  operators: OperatorUser[],
  scopedUserIds?: number[] | undefined
): InteractionMonitoringFilters {
  const resolved = resolveInteractionUsers(state, operators, scopedUserIds)
  const user_ids = resolved.kind === 'ids' ? resolved.ids : undefined

  let from_datetime: string | undefined
  let to_datetime: string | undefined
  if (state.period === 'custom' && state.customFromDate && state.customToDate) {
    const r = localDateStringsToIsoRange(state.customFromDate, state.customToDate)
    from_datetime = r.from_datetime
    to_datetime = r.to_datetime
  }

  // Internal-date range: convert YYYY-MM-DD bounds to ISO datetimes the
  // backend can bind. Only forwarded when both a date type AND at least one
  // bound are set â€” backend treats a date type with no bounds as a no-op.
  let internal_date_from: string | undefined
  let internal_date_to: string | undefined
  if (state.internal_date_type && (state.internal_date_from || state.internal_date_to)) {
    const r = localDateStringsToIsoRange(
      state.internal_date_from ?? state.internal_date_to ?? '',
      state.internal_date_to ?? state.internal_date_from ?? ''
    )
    internal_date_from = state.internal_date_from ? r.from_datetime : undefined
    internal_date_to = state.internal_date_to ? r.to_datetime : undefined
  }

  return {
    period: state.period,
    result_ids: state.result_ids,
    contact_type_ids: state.contact_type_ids,
    promise_amount_min: state.promise_amount_min,
    promise_amount_max: state.promise_amount_max,
    internal_date_type: state.internal_date_type,
    internal_date_from,
    internal_date_to,
    channel: state.channel,
    sort_by: state.sort_by,
    sort_dir: state.sort_dir,
    user_ids,
    from_datetime,
    to_datetime,
  }
}
