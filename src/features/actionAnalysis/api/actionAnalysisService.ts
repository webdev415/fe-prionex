import { api } from '@/lib/api'
import type {
  CallMonitoringFilters,
  CallMonitoringResponse,
  InteractionMonitoringFilters,
  InteractionMonitoringResponse,
} from '../types'

function buildCallParams(filters: CallMonitoringFilters): URLSearchParams {
  const params = new URLSearchParams()
  filters.agent_extensions?.forEach((ext) => {
    if (ext) params.append('agent_extensions', ext)
  })
  if (filters.phone_number) params.set('phone_number', filters.phone_number)
  if (filters.outcome_filter) params.set('outcome_filter', filters.outcome_filter)
  if (filters.min_duration != null) params.set('min_duration', String(filters.min_duration))
  if (filters.max_duration != null) params.set('max_duration', String(filters.max_duration))
  if (filters.period) params.set('period', filters.period)
  if (filters.from_datetime) params.set('from_datetime', filters.from_datetime)
  if (filters.to_datetime) params.set('to_datetime', filters.to_datetime)
  if (filters.campaign_id) params.set('campaign_id', filters.campaign_id)
  if (filters.sort) params.set('sort', filters.sort)
  if (filters.limit != null) params.set('limit', String(filters.limit))
  if (filters.offset != null) params.set('offset', String(filters.offset))
  return params
}

export async function getCallMonitoring(
  filters: CallMonitoringFilters
): Promise<CallMonitoringResponse> {
  const response = await api.get<CallMonitoringResponse>('/api/v1/calls/monitoring', {
    params: buildCallParams(filters),
  })
  return response.data
}

export async function exportCallMonitoring(filters: CallMonitoringFilters): Promise<Blob> {
  const params = buildCallParams(filters)
  const response = await api.get<Blob>('/api/v1/calls/monitoring/export', {
    params,
    responseType: 'blob',
    timeout: 120_000,
  })
  return response.data
}

function buildInteractionParams(filters: InteractionMonitoringFilters): URLSearchParams {
  const params = new URLSearchParams()
  filters.user_ids?.forEach((id) => params.append('user_ids', String(id)))
  if (filters.period) params.set('period', filters.period)
  if (filters.from_datetime) params.set('from_datetime', filters.from_datetime)
  if (filters.to_datetime) params.set('to_datetime', filters.to_datetime)
  if (filters.promise_amount_min != null)
    params.set('promise_amount_min', String(filters.promise_amount_min))
  if (filters.promise_amount_max != null)
    params.set('promise_amount_max', String(filters.promise_amount_max))
  filters.result_ids?.forEach((id) => params.append('result_ids', String(id)))
  filters.contact_type_ids?.forEach((id) => params.append('contact_type_ids', String(id)))
  if (filters.internal_date_type) params.set('internal_date_type', filters.internal_date_type)
  if (filters.internal_date_from) params.set('internal_date_from', filters.internal_date_from)
  if (filters.internal_date_to) params.set('internal_date_to', filters.internal_date_to)
  if (filters.channel) params.set('channel', filters.channel)
  if (filters.sort_by) params.set('sort_by', filters.sort_by)
  if (filters.sort_dir) params.set('sort_dir', filters.sort_dir)
  if (filters.page != null) params.set('page', String(filters.page))
  if (filters.page_size != null) params.set('page_size', String(filters.page_size))
  return params
}

export async function getInteractionMonitoring(
  filters: InteractionMonitoringFilters
): Promise<InteractionMonitoringResponse> {
  const response = await api.get<InteractionMonitoringResponse>('/api/v1/interactions', {
    params: buildInteractionParams(filters),
  })
  return response.data
}

export async function exportInteractionMonitoring(
  filters: InteractionMonitoringFilters
): Promise<Blob> {
  const params = buildInteractionParams(filters)
  const response = await api.get<Blob>('/api/v1/interactions/export', {
    params,
    responseType: 'blob',
    timeout: 120_000,
  })
  return response.data
}

/**
 * Distinct, project-scoped values present in `interactions.channel`. Source
 * for the Action Analysis Interaction History "Channel" filter dropdown.
 */
export async function listInteractionChannels(): Promise<string[]> {
  const response = await api.get<string[]>('/api/v1/interaction-channels')
  return response.data
}

import type {
  TAInteractionListParams,
  TAInteractionListResponse,
} from '@/features/taInteractions/api/types'

function buildTaHistoryParams(filters: TAInteractionListParams): URLSearchParams {
  // Repeated `?key=val&key=val` for list params — FastAPI's
  // `Optional[List[int]] = Query(None)` rejects Axios's default `[]` suffix.
  const params = new URLSearchParams()
  if (filters.client_id != null) params.set('client_id', String(filters.client_id))
  if (filters.chain_id != null) params.set('chain_id', String(filters.chain_id))
  if (filters.recorded_by != null) params.set('recorded_by', String(filters.recorded_by))
  if (filters.leaf_node_id != null) params.set('leaf_node_id', String(filters.leaf_node_id))
  if (filters.date_from) params.set('date_from', filters.date_from)
  if (filters.date_to) params.set('date_to', filters.date_to)
  if (filters.notes_search) params.set('notes_search', filters.notes_search)
  filters.recorded_by_in?.forEach((id) => params.append('recorded_by_in', String(id)))
  if (filters.assigned_operator_id != null) {
    params.set('assigned_operator_id', String(filters.assigned_operator_id))
  }
  if (filters.target_action_id != null) {
    params.set('target_action_id', String(filters.target_action_id))
  }
  if (filters.promise_date_from) params.set('promise_date_from', filters.promise_date_from)
  if (filters.promise_date_to) params.set('promise_date_to', filters.promise_date_to)
  if (filters.skip != null) params.set('skip', String(filters.skip))
  if (filters.limit != null) params.set('limit', String(filters.limit))
  return params
}

export async function getTaHistory(
  filters: TAInteractionListParams
): Promise<TAInteractionListResponse> {
  const response = await api.get<TAInteractionListResponse>('/api/v1/ta-interactions', {
    params: buildTaHistoryParams(filters),
  })
  return response.data
}

export async function exportTaHistory(filters: TAInteractionListParams): Promise<Blob> {
  const response = await api.get<Blob>('/api/v1/ta-interactions/export', {
    params: buildTaHistoryParams(filters),
    responseType: 'blob',
    timeout: 120_000,
  })
  return response.data
}

export const actionAnalysisService = {
  getCallMonitoring,
  exportCallMonitoring,
  getInteractionMonitoring,
  exportInteractionMonitoring,
  listInteractionChannels,
  getTaHistory,
  exportTaHistory,
}
