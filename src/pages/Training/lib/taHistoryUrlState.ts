import type { CallMonitoringPeriod } from '@/features/training'
import type { TAInteractionListParams } from '@/features/taInteractions/api/types'
import { localDateStringsToIsoRange } from './dateRange'

const DEFAULT_PERIOD: CallMonitoringPeriod = 'last_7d'

export interface StepValueEntry {
  eq?: string
  min?: string
  max?: string
}

export interface TaHistoryBarState {
  period?: CallMonitoringPeriod
  customFromDate?: string
  customToDate?: string
  departmentId: number | null
  employeeIds: number[]
  chainId?: number
  targetActionIds: number[]
  stepValues: Record<number, StepValueEntry>
  notesSearch?: string
}

export const TA_HISTORY_FILTERS_DEFAULT: TaHistoryBarState = {
  period: DEFAULT_PERIOD,
  customFromDate: undefined,
  customToDate: undefined,
  departmentId: null,
  employeeIds: [],
  chainId: undefined,
  targetActionIds: [],
  stepValues: {},
  notesSearch: undefined,
}

function parseStepValueList(items: string[]): Map<number, string> {
  const out = new Map<number, string>()
  for (const raw of items) {
    if (!raw || !raw.includes(':')) continue
    const colon = raw.indexOf(':')
    const head = raw.slice(0, colon)
    const value = raw.slice(colon + 1)
    const id = Number(head)
    if (Number.isFinite(id) && id > 0) out.set(id, value)
  }
  return out
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

  const targetActionIds = params
    .getAll('step')
    .map((s) => Number(s))
    .filter((n) => Number.isFinite(n) && n > 0)

  // Per-step value sub-filters only carry meaning when at least one step is
  // picked AND a chain is set (resolver needs the chain to map ta_id → step).
  const stepValues: Record<number, StepValueEntry> = {}
  if (chainId != null && targetActionIds.length > 0) {
    const eqMap = parseStepValueList(params.getAll('step_eq'))
    const minMap = parseStepValueList(params.getAll('step_min'))
    const maxMap = parseStepValueList(params.getAll('step_max'))
    const picked = new Set(targetActionIds)
    for (const id of picked) {
      const entry: StepValueEntry = {}
      if (eqMap.has(id)) entry.eq = eqMap.get(id)
      if (minMap.has(id)) entry.min = minMap.get(id)
      if (maxMap.has(id)) entry.max = maxMap.get(id)
      if (entry.eq || entry.min || entry.max) stepValues[id] = entry
    }
  }

  return {
    period,
    customFromDate: params.get('from_date') ?? undefined,
    customToDate: params.get('to_date') ?? undefined,
    departmentId: dept ? Number(dept) : null,
    employeeIds,
    chainId: Number.isFinite(chainId) ? chainId : undefined,
    targetActionIds,
    stepValues,
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
  next.delete('step_eq')
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
  if (state.chainId != null && state.targetActionIds.length > 0) {
    for (const id of state.targetActionIds) {
      next.append('step', String(id))
    }
    for (const id of state.targetActionIds) {
      const entry = state.stepValues[id]
      if (!entry) continue
      if (entry.eq) next.append('step_eq', `${id}:${entry.eq}`)
      if (entry.min) next.append('step_min', `${id}:${entry.min}`)
      if (entry.max) next.append('step_max', `${id}:${entry.max}`)
    }
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

  const step_value_eq: string[] = []
  const step_value_min: string[] = []
  const step_value_max: string[] = []
  for (const id of state.targetActionIds) {
    const entry = state.stepValues[id]
    if (!entry) continue
    if (entry.eq) step_value_eq.push(`${id}:${entry.eq}`)
    if (entry.min) step_value_min.push(`${id}:${entry.min}`)
    if (entry.max) step_value_max.push(`${id}:${entry.max}`)
  }

  return {
    chain_id: state.chainId,
    target_action_id_in: state.targetActionIds.length > 0 ? state.targetActionIds : undefined,
    recorded_by_in: recordedByIn,
    date_from,
    date_to,
    step_value_eq: step_value_eq.length ? step_value_eq : undefined,
    step_value_min: step_value_min.length ? step_value_min : undefined,
    step_value_max: step_value_max.length ? step_value_max : undefined,
    notes_search: state.notesSearch,
  }
}
