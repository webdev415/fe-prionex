import { api } from '@/lib/api'
import type {
  AnalyticsRangeFilters,
  HeatmapFilters,
  HeatmapResponse,
  IngestEventsRequest,
  IngestEventsResponse,
  ScreenTimeResponse,
  ScriptAnalyticsResponse,
  TimelineQuery,
  TimelineResponse,
} from '../types'

const ANALYTICS_BASE = '/api/v1/analytics'

function buildRangeParams(filters: AnalyticsRangeFilters): URLSearchParams {
  const params = new URLSearchParams()
  filters.operator_ids?.forEach((id) => params.append('operator_ids', String(id)))
  filters.department_ids?.forEach((id) => params.append('department_ids', String(id)))
  if (filters.period) params.set('period', filters.period)
  if (filters.from_date) params.set('from_date', filters.from_date)
  if (filters.to_date) params.set('to_date', filters.to_date)
  return params
}

export async function ingestEvents(payload: IngestEventsRequest): Promise<IngestEventsResponse> {
  const response = await api.post<IngestEventsResponse>(`${ANALYTICS_BASE}/events`, payload, {
    timeout: 5_000,
  })
  return response.data
}

export function buildIngestEventsBody(payload: IngestEventsRequest): string {
  return JSON.stringify(payload)
}

export async function getTimeline(query: TimelineQuery): Promise<TimelineResponse> {
  const response = await api.get<TimelineResponse>(`${ANALYTICS_BASE}/timeline`, {
    params: { call_id: query.call_id },
  })
  return response.data
}

export async function exportTimeline(query: TimelineQuery): Promise<Blob> {
  const response = await api.get<Blob>(`${ANALYTICS_BASE}/timeline/export`, {
    params: { call_id: query.call_id },
    responseType: 'blob',
    timeout: 60_000,
  })
  return response.data
}

export async function getScreenTime(filters: AnalyticsRangeFilters): Promise<ScreenTimeResponse> {
  const response = await api.get<ScreenTimeResponse>(`${ANALYTICS_BASE}/screen-time`, {
    params: buildRangeParams(filters),
  })
  return response.data
}

export async function exportScreenTime(filters: AnalyticsRangeFilters): Promise<Blob> {
  const response = await api.get<Blob>(`${ANALYTICS_BASE}/screen-time/export`, {
    params: buildRangeParams(filters),
    responseType: 'blob',
    timeout: 120_000,
  })
  return response.data
}

export async function getHeatmap(filters: HeatmapFilters): Promise<HeatmapResponse> {
  const params = buildRangeParams(filters)
  if (filters.state_filter) params.set('state_filter', filters.state_filter)
  const response = await api.get<HeatmapResponse>(`${ANALYTICS_BASE}/heatmap`, { params })
  return response.data
}

export async function exportHeatmap(filters: HeatmapFilters): Promise<Blob> {
  const params = buildRangeParams(filters)
  if (filters.state_filter) params.set('state_filter', filters.state_filter)
  const response = await api.get<Blob>(`${ANALYTICS_BASE}/heatmap/export`, {
    params,
    responseType: 'blob',
    timeout: 120_000,
  })
  return response.data
}

export async function getScriptAnalytics(
  filters: AnalyticsRangeFilters
): Promise<ScriptAnalyticsResponse> {
  const response = await api.get<ScriptAnalyticsResponse>(`${ANALYTICS_BASE}/script-analytics`, {
    params: buildRangeParams(filters),
  })
  return response.data
}

export async function exportScriptAnalytics(filters: AnalyticsRangeFilters): Promise<Blob> {
  const response = await api.get<Blob>(`${ANALYTICS_BASE}/script-analytics/export`, {
    params: buildRangeParams(filters),
    responseType: 'blob',
    timeout: 120_000,
  })
  return response.data
}

export const operatorAnalyticsService = {
  ingestEvents,
  buildIngestEventsBody,
  getTimeline,
  exportTimeline,
  getScreenTime,
  exportScreenTime,
  getHeatmap,
  exportHeatmap,
  getScriptAnalytics,
  exportScriptAnalytics,
}
