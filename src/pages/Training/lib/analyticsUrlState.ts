import type {
  AnalyticsPeriod,
  AnalyticsRangeFilters,
  HeatmapFilters,
  HeatmapState,
} from '@/features/operatorAnalytics'

export interface AnalyticsBarState {
  operator_ids?: number[]
  period: AnalyticsPeriod
  customFromDate?: string
  customToDate?: string
}

const DEFAULT_PERIOD: AnalyticsPeriod = 'last_7d'

export const ANALYTICS_BAR_DEFAULT: AnalyticsBarState = {
  operator_ids: undefined,
  period: DEFAULT_PERIOD,
  customFromDate: undefined,
  customToDate: undefined,
}

export function readAnalyticsBarState(params: URLSearchParams): AnalyticsBarState {
  const ids = params
    .getAll('operator_id')
    .map((v) => Number(v))
    .filter((n) => Number.isFinite(n) && n > 0)
  const period = (params.get('period') as AnalyticsPeriod | null) ?? DEFAULT_PERIOD
  const customFromDate = params.get('from_date') ?? undefined
  const customToDate = params.get('to_date') ?? undefined

  return {
    operator_ids: ids.length ? ids : undefined,
    period,
    customFromDate,
    customToDate,
  }
}

export function writeAnalyticsBarState(
  base: URLSearchParams,
  state: AnalyticsBarState
): URLSearchParams {
  const next = new URLSearchParams(base)
  next.delete('operator_id')
  next.delete('period')
  next.delete('from_date')
  next.delete('to_date')

  for (const id of state.operator_ids ?? []) {
    if (Number.isFinite(id)) next.append('operator_id', String(id))
  }
  if (state.period && state.period !== DEFAULT_PERIOD) next.set('period', state.period)
  if (state.period === 'custom' && state.customFromDate && state.customToDate) {
    next.set('from_date', state.customFromDate)
    next.set('to_date', state.customToDate)
  }
  return next
}

export function toAnalyticsRangeFilters(state: AnalyticsBarState): AnalyticsRangeFilters {
  if (state.period === 'custom' && state.customFromDate && state.customToDate) {
    return {
      operator_ids: state.operator_ids,
      period: 'custom',
      from_date: state.customFromDate,
      to_date: state.customToDate,
    }
  }
  return {
    operator_ids: state.operator_ids,
    period: state.period,
  }
}

export interface HeatmapBarState extends AnalyticsBarState {
  state_filter?: HeatmapState
}

export function readHeatmapBarState(params: URLSearchParams): HeatmapBarState {
  const base = readAnalyticsBarState(params)
  const stateFilter = params.get('state_filter')
  const allowed: HeatmapState[] = ['active_call', 'post_call', 'waiting', 'idle', 'break']
  return {
    ...base,
    state_filter:
      stateFilter && (allowed as string[]).includes(stateFilter)
        ? (stateFilter as HeatmapState)
        : undefined,
  }
}

export function writeHeatmapBarState(
  base: URLSearchParams,
  state: HeatmapBarState
): URLSearchParams {
  const next = writeAnalyticsBarState(base, state)
  next.delete('state_filter')
  if (state.state_filter) next.set('state_filter', state.state_filter)
  return next
}

export function toHeatmapFilters(state: HeatmapBarState): HeatmapFilters {
  return {
    ...toAnalyticsRangeFilters(state),
    state_filter: state.state_filter,
  }
}

export interface TimelineBarState {
  call_id?: string
}

export function readTimelineBarState(params: URLSearchParams): TimelineBarState {
  return { call_id: params.get('call_id') ?? undefined }
}

export function writeTimelineBarState(
  base: URLSearchParams,
  state: TimelineBarState
): URLSearchParams {
  const next = new URLSearchParams(base)
  next.delete('call_id')
  if (state.call_id) next.set('call_id', state.call_id)
  return next
}
