import type {
  CallMonitoringPeriod,
  PaymentMethod,
  PaymentMonitoringDateField,
  PaymentMonitoringFilters,
  PaymentMonitoringSort,
  PaymentStatus,
} from '@/features/actionAnalysis'
import {
  PAYMENT_METHOD_VALUES,
  PAYMENT_STATUS_VALUES,
  PAYMENT_TYPE_VALUES,
} from '@/features/actionAnalysis'
import { localDateStringsToIsoRange } from './dateRange'

const DEFAULT_PERIOD: CallMonitoringPeriod = 'last_7d'
const DEFAULT_SORT: PaymentMonitoringSort = 'recorded_at_desc'
const DEFAULT_DATE_FIELD: PaymentMonitoringDateField = 'recorded_at'

const PAYMENT_MONITORING_SORTS: readonly PaymentMonitoringSort[] = [
  'recorded_at_desc',
  'recorded_at_asc',
  'verified_at_desc',
  'verified_at_asc',
  'amount_desc',
  'amount_asc',
  'payment_date_desc',
  'payment_date_asc',
]

const PAYMENT_DATE_FIELDS: readonly PaymentMonitoringDateField[] = [
  'recorded_at',
  'verified_at',
  'payment_date',
]

/** Bar state for the Payment History sub-tab.
 *
 * `period` + `customFromDate`/`customToDate` drive the date-range picker; the
 * resolved range applies to whichever column is named by `dateField`.
 *
 * `employeeIds` is the tab-level Operator refinement. When the page-level
 * scope selector locks the picker (scope=my/group), this is ignored at query
 * time but kept on the URL for round-trip stability.
 *
 * `paymentTypes` accepts arbitrary strings to keep legacy free-text values
 * round-trippable; the FE filter UI only exposes KAN-507's three values.
 */
export interface PaymentHistoryBarState {
  period?: CallMonitoringPeriod
  customFromDate?: string
  customToDate?: string
  dateField: PaymentMonitoringDateField
  employeeIds: number[]
  paymentMethods: PaymentMethod[]
  statuses: PaymentStatus[]
  paymentTypes: string[]
  amountMin?: number
  amountMax?: number
  sort: PaymentMonitoringSort
}

export const PAYMENT_HISTORY_FILTERS_DEFAULT: PaymentHistoryBarState = {
  period: DEFAULT_PERIOD,
  customFromDate: undefined,
  customToDate: undefined,
  dateField: DEFAULT_DATE_FIELD,
  employeeIds: [],
  paymentMethods: [],
  statuses: [],
  paymentTypes: [],
  amountMin: undefined,
  amountMax: undefined,
  sort: DEFAULT_SORT,
}

function parseNonNegativeNumber(value: string | null | undefined): number | undefined {
  if (value == null || value === '') return undefined
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? n : undefined
}

function parseEnum<T extends string>(value: string | null, allowed: readonly T[]): T | undefined {
  if (value == null) return undefined
  return (allowed as readonly string[]).includes(value) ? (value as T) : undefined
}

function parseEnumList<T extends string>(values: readonly string[], allowed: readonly T[]): T[] {
  const allowedSet = new Set(allowed as readonly string[])
  return values.filter((v): v is T => allowedSet.has(v))
}

export function readPaymentHistoryUrlState(params: URLSearchParams): PaymentHistoryBarState {
  const period =
    parseEnum<CallMonitoringPeriod>(params.get('period'), [
      'today',
      'yesterday',
      'last_7d',
      'last_30d',
      'custom',
    ]) ?? DEFAULT_PERIOD

  const dateField =
    parseEnum<PaymentMonitoringDateField>(params.get('date_field'), PAYMENT_DATE_FIELDS) ??
    DEFAULT_DATE_FIELD

  const employeeIds = params
    .getAll('employee_id')
    .map((s) => Number(s))
    .filter((n) => Number.isFinite(n) && n > 0)

  const paymentMethods = parseEnumList<PaymentMethod>(
    params.getAll('payment_method'),
    PAYMENT_METHOD_VALUES
  )
  const statuses = parseEnumList<PaymentStatus>(params.getAll('status'), PAYMENT_STATUS_VALUES)
  // Legacy free-text values are preserved verbatim; new ones must come from KAN-507.
  // The UI only exposes the controlled list, so anything else is a deep-link relic.
  const paymentTypes = params.getAll('payment_type').filter((v) => v.length > 0)

  return {
    period,
    customFromDate: params.get('from_date') ?? undefined,
    customToDate: params.get('to_date') ?? undefined,
    dateField,
    employeeIds,
    paymentMethods,
    statuses,
    paymentTypes,
    amountMin: parseNonNegativeNumber(params.get('amount_min')),
    amountMax: parseNonNegativeNumber(params.get('amount_max')),
    sort:
      parseEnum<PaymentMonitoringSort>(params.get('sort'), PAYMENT_MONITORING_SORTS) ??
      DEFAULT_SORT,
  }
}

export function writePaymentHistoryUrlState(
  base: URLSearchParams,
  state: PaymentHistoryBarState
): URLSearchParams {
  const next = new URLSearchParams(base)
  ;[
    'period',
    'from_date',
    'to_date',
    'date_field',
    'employee_id',
    'payment_method',
    'status',
    'payment_type',
    'amount_min',
    'amount_max',
    'sort',
  ].forEach((k) => next.delete(k))

  if (state.period && state.period !== DEFAULT_PERIOD) next.set('period', state.period)
  if (state.period === 'custom' && state.customFromDate && state.customToDate) {
    next.set('from_date', state.customFromDate)
    next.set('to_date', state.customToDate)
  }
  if (state.dateField && state.dateField !== DEFAULT_DATE_FIELD) {
    next.set('date_field', state.dateField)
  }
  for (const id of state.employeeIds) next.append('employee_id', String(id))
  for (const m of state.paymentMethods) next.append('payment_method', m)
  for (const s of state.statuses) next.append('status', s)
  for (const t of state.paymentTypes) next.append('payment_type', t)
  if (state.amountMin != null) next.set('amount_min', String(state.amountMin))
  if (state.amountMax != null) next.set('amount_max', String(state.amountMax))
  if (state.sort && state.sort !== DEFAULT_SORT) next.set('sort', state.sort)
  return next
}

function resolveDateRange(state: PaymentHistoryBarState): {
  from_datetime?: string
  to_datetime?: string
} {
  if (state.period === 'custom') {
    if (!state.customFromDate || !state.customToDate) return {}
    const r = localDateStringsToIsoRange(state.customFromDate, state.customToDate)
    return { from_datetime: r.from_datetime, to_datetime: r.to_datetime }
  }
  const now = new Date()
  if (state.period === 'today') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    return { from_datetime: start.toISOString(), to_datetime: now.toISOString() }
  }
  if (state.period === 'yesterday') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    return { from_datetime: start.toISOString(), to_datetime: end.toISOString() }
  }
  if (state.period === 'last_7d') {
    const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    return { from_datetime: start.toISOString(), to_datetime: now.toISOString() }
  }
  if (state.period === 'last_30d') {
    const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    return { from_datetime: start.toISOString(), to_datetime: now.toISOString() }
  }
  return {}
}

/**
 * Compose the bar state with the page-level scope's resolved user IDs.
 *
 * `scopedUserIds === undefined` means "no scope filter" (scope=all). When set,
 * we intersect with the tab-level employee refinement. When the intersection is
 * empty AND the user explicitly picked an employee, we pass that empty list
 * through so the backend returns nothing (UI will render the empty state) —
 * silently ignoring the user's choice would be worse than showing zero rows.
 */
function resolveEffectiveUserIds(
  scopedUserIds: number[] | undefined,
  employeeRefinement: number[]
): number[] | undefined {
  if (scopedUserIds == null) {
    return employeeRefinement.length > 0 ? employeeRefinement : undefined
  }
  if (employeeRefinement.length === 0) {
    return scopedUserIds
  }
  const scopeSet = new Set(scopedUserIds)
  return employeeRefinement.filter((id) => scopeSet.has(id))
}

export function toPaymentMonitoringQuery(
  state: PaymentHistoryBarState,
  scopedUserIds: number[] | undefined,
  options: { page?: number; limit?: number } = {}
): PaymentMonitoringFilters {
  const effectiveUserIds = resolveEffectiveUserIds(scopedUserIds, state.employeeIds)
  return {
    period: state.period,
    ...resolveDateRange(state),
    date_field: state.dateField,
    user_ids: effectiveUserIds,
    payment_method_in: state.paymentMethods.length > 0 ? state.paymentMethods : undefined,
    status_in: state.statuses.length > 0 ? state.statuses : undefined,
    payment_type_in: state.paymentTypes.length > 0 ? state.paymentTypes : undefined,
    amount_min: state.amountMin,
    amount_max: state.amountMax,
    sort: state.sort,
    page: options.page,
    limit: options.limit,
  }
}

// Re-export the controlled-vocabulary tuple for filter UI usage.
export { PAYMENT_TYPE_VALUES, PAYMENT_METHOD_VALUES, PAYMENT_STATUS_VALUES }
