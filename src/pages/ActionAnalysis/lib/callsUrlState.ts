import type {
  CallMonitoringFilters,
  CallMonitoringOutcomeFilter,
  CallMonitoringPeriod,
} from '@/features/actionAnalysis'
import type { CallFiltersBarValue } from '../components/CallFiltersBar'
import { localDateStringsToIsoRange } from './dateRange'

const DEFAULT_PERIOD: CallMonitoringPeriod = 'last_7d'

export function readCallsUrlState(params: URLSearchParams): CallFiltersBarValue {
  const ext = params.get('agent_extension') ?? params.get('employee_id')
  const period = (params.get('period') as CallMonitoringPeriod | null) ?? DEFAULT_PERIOD
  const status = (params.get('status') as CallMonitoringOutcomeFilter | null) ?? 'all'
  const min = params.get('min_duration')
  const max = params.get('max_duration')
  const fromDate = params.get('from_date') ?? undefined
  const toDate = params.get('to_date') ?? undefined

  return {
    agent_extensions: ext ? [ext] : undefined,
    period,
    outcome_filter: status,
    min_duration: min ? Number(min) : undefined,
    max_duration: max ? Number(max) : undefined,
    customFromDate: fromDate,
    customToDate: toDate,
  }
}

export function writeCallsUrlState(
  base: URLSearchParams,
  state: CallFiltersBarValue
): URLSearchParams {
  const next = new URLSearchParams(base)
  next.delete('agent_extension')
  next.delete('employee_id')
  next.delete('period')
  next.delete('status')
  next.delete('min_duration')
  next.delete('max_duration')
  next.delete('from_date')
  next.delete('to_date')

  const ext = state.agent_extensions?.[0]
  if (ext) next.set('agent_extension', ext)
  if (state.period && state.period !== DEFAULT_PERIOD) next.set('period', state.period)
  if (state.outcome_filter && state.outcome_filter !== 'all')
    next.set('status', state.outcome_filter)
  if (state.min_duration != null) next.set('min_duration', String(state.min_duration))
  if (state.max_duration != null) next.set('max_duration', String(state.max_duration))
  if (state.period === 'custom' && state.customFromDate && state.customToDate) {
    next.set('from_date', state.customFromDate)
    next.set('to_date', state.customToDate)
  }
  return next
}

export function toCallMonitoringQuery(state: CallFiltersBarValue): CallMonitoringFilters {
  const { customFromDate, customToDate, ...rest } = state
  if (rest.period === 'custom' && customFromDate && customToDate) {
    const { from_datetime, to_datetime } = localDateStringsToIsoRange(customFromDate, customToDate)
    return { ...rest, from_datetime, to_datetime }
  }
  return { ...rest, from_datetime: undefined, to_datetime: undefined }
}
