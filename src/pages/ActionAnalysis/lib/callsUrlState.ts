import {
  TELEPHONY_TYPE_VALUES,
  type CallMonitoringFilters,
  type CallMonitoringOutcomeFilter,
  type CallMonitoringPeriod,
  type TelephonyType,
} from '@/features/actionAnalysis'
import type { CallFiltersBarValue } from '../components/CallFiltersBar'
import { localDateStringsToIsoRange } from './dateRange'

const DEFAULT_PERIOD: CallMonitoringPeriod = 'last_7d'

const TELEPHONY_TYPE_SET = new Set<TelephonyType>(TELEPHONY_TYPE_VALUES)

export const CALL_FILTERS_DEFAULT: CallFiltersBarValue = {
  agent_extensions: undefined,
  phone_number: undefined,
  outcome_filter: 'all',
  min_duration: undefined,
  max_duration: undefined,
  period: DEFAULT_PERIOD,
  customFromDate: undefined,
  customToDate: undefined,
  telephony_types: undefined,
}

export function readCallsUrlState(params: URLSearchParams): CallFiltersBarValue {
  // Multi-value via repeated agent_extension=... params; tolerate single
  // agent_extension or legacy employee_id for shared-link compat.
  const exts = params.getAll('agent_extension').filter(Boolean)
  if (exts.length === 0) {
    const legacy = params.get('employee_id')
    if (legacy) exts.push(legacy)
  }
  const period = (params.get('period') as CallMonitoringPeriod | null) ?? DEFAULT_PERIOD
  const status = (params.get('status') as CallMonitoringOutcomeFilter | null) ?? 'all'
  const phone = params.get('phone') ?? undefined
  const min = params.get('min_duration')
  const max = params.get('max_duration')
  const fromDate = params.get('from_date') ?? undefined
  const toDate = params.get('to_date') ?? undefined

  // Comma-separated list. Drop anything that isn't a valid enum value so
  // hand-edited URLs can't smuggle bad input into the request.
  const telephonyRaw = params.get('telephony_types')
  const telephony_types = telephonyRaw
    ? telephonyRaw
        .split(',')
        .map((v) => v.trim())
        .filter((v): v is TelephonyType => TELEPHONY_TYPE_SET.has(v as TelephonyType))
    : []

  return {
    agent_extensions: exts.length ? exts : undefined,
    phone_number: phone,
    period,
    outcome_filter: status,
    min_duration: min ? Number(min) : undefined,
    max_duration: max ? Number(max) : undefined,
    customFromDate: fromDate,
    customToDate: toDate,
    telephony_types: telephony_types.length ? telephony_types : undefined,
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
  next.delete('phone')
  next.delete('min_duration')
  next.delete('max_duration')
  next.delete('from_date')
  next.delete('to_date')
  next.delete('telephony_types')

  for (const ext of state.agent_extensions ?? []) {
    if (ext) next.append('agent_extension', ext)
  }
  if (state.period && state.period !== DEFAULT_PERIOD) next.set('period', state.period)
  if (state.outcome_filter && state.outcome_filter !== 'all')
    next.set('status', state.outcome_filter)
  if (state.phone_number) next.set('phone', state.phone_number)
  if (state.min_duration != null) next.set('min_duration', String(state.min_duration))
  if (state.max_duration != null) next.set('max_duration', String(state.max_duration))
  if (state.period === 'custom' && state.customFromDate && state.customToDate) {
    next.set('from_date', state.customFromDate)
    next.set('to_date', state.customToDate)
  }
  if (state.telephony_types?.length) {
    next.set('telephony_types', state.telephony_types.join(','))
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
