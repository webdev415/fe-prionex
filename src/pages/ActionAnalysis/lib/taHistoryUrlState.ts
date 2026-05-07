import type { CallMonitoringPeriod } from '@/features/actionAnalysis'
import type { TAInteractionListParams } from '@/features/taInteractions/api/types'
import { localDateStringsToIsoRange } from './dateRange'

const DEFAULT_PERIOD: CallMonitoringPeriod = 'last_7d'

export interface TaHistoryBarState {
  period?: CallMonitoringPeriod
  customFromDate?: string
  customToDate?: string
  departmentId: number | null
  employeeIds: number[]
  chainId?: number
  targetActionId?: number
  promiseDateFrom?: string
  promiseDateTo?: string
  notesSearch?: string
}

export const TA_HISTORY_FILTERS_DEFAULT: TaHistoryBarState = {
  period: DEFAULT_PERIOD,
  customFromDate: undefined,
  customToDate: undefined,
  departmentId: null,
  employeeIds: [],
  chainId: undefined,
  targetActionId: undefined,
  promiseDateFrom: undefined,
  promiseDateTo: undefined,
  notesSearch: undefined,
}

export function readTaHistoryUrlState(params: URLSearchParams): TaHistoryBarState {
  const period = (params.get('period') as CallMonitoringPeriod | null) ?? DEFAULT_PERIOD
  const dept = params.get('department_id')
  const employeeIds = params
    .getAll('employee_id')
    .map((s) => Number(s))
    .filter((n) => Number.isFinite(n) && n > 0)

  const chainIdRaw = params.get('chain_id')
  const chainId = chainIdRaw ? Number(chainIdRaw) : undefined
  const stepRaw = params.get('step')
  const targetActionId = chainId && stepRaw ? Number(stepRaw) : undefined

  return {
    period,
    customFromDate: params.get('from_date') ?? undefined,
    customToDate: params.get('to_date') ?? undefined,
    departmentId: dept ? Number(dept) : null,
    employeeIds,
    chainId: Number.isFinite(chainId) ? chainId : undefined,
    targetActionId: Number.isFinite(targetActionId) ? targetActionId : undefined,
    promiseDateFrom: params.get('promise_from') ?? undefined,
    promiseDateTo: params.get('promise_to') ?? undefined,
    notesSearch: params.get('notes') ?? undefined,
  }
}

export function writeTaHistoryUrlState(
  base: URLSearchParams,
  state: TaHistoryBarState
): URLSearchParams {
  const next = new URLSearchParams(base)
  next.delete('period')
  next.delete('from_date')
  next.delete('to_date')
  next.delete('department_id')
  next.delete('employee_id')
  next.delete('chain_id')
  next.delete('step')
  next.delete('promise_from')
  next.delete('promise_to')
  next.delete('notes')

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
  if (state.chainId != null) next.set('chain_id', String(state.chainId))
  if (state.chainId != null && state.targetActionId != null) {
    next.set('step', String(state.targetActionId))
  }
  if (state.promiseDateFrom) next.set('promise_from', state.promiseDateFrom)
  if (state.promiseDateTo) next.set('promise_to', state.promiseDateTo)
  if (state.notesSearch && state.notesSearch.trim()) {
    next.set('notes', state.notesSearch.trim())
  }
  return next
}

export function toTaHistoryQuery(
  state: TaHistoryBarState,
  recordedByIn: number[] | undefined
): TAInteractionListParams {
  let date_from: string | undefined
  let date_to: string | undefined
  if (state.period === 'custom' && state.customFromDate && state.customToDate) {
    const r = localDateStringsToIsoRange(state.customFromDate, state.customToDate)
    date_from = r.from_datetime
    date_to = r.to_datetime
  } else if (state.period === 'today') {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    date_from = start.toISOString()
    date_to = now.toISOString()
  } else if (state.period === 'yesterday') {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    date_from = start.toISOString()
    date_to = end.toISOString()
  } else if (state.period === 'last_7d') {
    const now = new Date()
    const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    date_from = start.toISOString()
    date_to = now.toISOString()
  } else if (state.period === 'last_30d') {
    const now = new Date()
    const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    date_from = start.toISOString()
    date_to = now.toISOString()
  }

  let promise_date_from: string | undefined
  let promise_date_to: string | undefined
  if (state.promiseDateFrom || state.promiseDateTo) {
    const r = localDateStringsToIsoRange(
      state.promiseDateFrom ?? state.promiseDateTo ?? '',
      state.promiseDateTo ?? state.promiseDateFrom ?? ''
    )
    promise_date_from = state.promiseDateFrom ? r.from_datetime : undefined
    promise_date_to = state.promiseDateTo ? r.to_datetime : undefined
  }

  return {
    chain_id: state.chainId,
    target_action_id: state.targetActionId,
    recorded_by_in: recordedByIn,
    date_from,
    date_to,
    promise_date_from,
    promise_date_to,
    notes_search: state.notesSearch,
  }
}
