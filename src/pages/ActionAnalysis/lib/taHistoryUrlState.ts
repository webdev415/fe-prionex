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
  stepValueEq?: string
  stepValueMin?: string
  stepValueMax?: string
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
  stepValueEq: undefined,
  stepValueMin: undefined,
  stepValueMax: undefined,
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

  // Step value sub-filters only carry meaning when a step is picked.
  const hasStep = chainId != null && targetActionId != null
  return {
    period,
    customFromDate: params.get('from_date') ?? undefined,
    customToDate: params.get('to_date') ?? undefined,
    departmentId: dept ? Number(dept) : null,
    employeeIds,
    chainId: Number.isFinite(chainId) ? chainId : undefined,
    targetActionId: Number.isFinite(targetActionId) ? targetActionId : undefined,
    stepValueEq: hasStep ? (params.get('step_value') ?? undefined) : undefined,
    stepValueMin: hasStep ? (params.get('step_min') ?? undefined) : undefined,
    stepValueMax: hasStep ? (params.get('step_max') ?? undefined) : undefined,
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
  next.delete('step_value')
  next.delete('step_min')
  next.delete('step_max')
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
    if (state.stepValueEq) next.set('step_value', state.stepValueEq)
    if (state.stepValueMin) next.set('step_min', state.stepValueMin)
    if (state.stepValueMax) next.set('step_max', state.stepValueMax)
  }
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

  return {
    chain_id: state.chainId,
    target_action_id: state.targetActionId,
    recorded_by_in: recordedByIn,
    date_from,
    date_to,
    step_value_eq: state.stepValueEq,
    step_value_min: state.stepValueMin,
    step_value_max: state.stepValueMax,
    notes_search: state.notesSearch,
  }
}
