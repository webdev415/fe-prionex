import { api } from '@/lib/api'
import type {
  CallMonitoringFilters,
  CallMonitoringResponse,
  CallsByPhoneFilters,
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

export async function getCallsByPhone(
  filters: CallsByPhoneFilters
): Promise<CallMonitoringResponse> {
  const params = new URLSearchParams()
  params.set('phone', filters.phone)
  if (filters.sort) params.set('sort', filters.sort)
  if (filters.limit != null) params.set('limit', String(filters.limit))
  if (filters.offset != null) params.set('offset', String(filters.offset))

  const response = await api.get<CallMonitoringResponse>('/api/v1/calls/monitoring/by-phone', {
    params,
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

export const actionAnalysisService = {
  getCallMonitoring,
  getCallsByPhone,
  exportCallMonitoring,
  getInteractionMonitoring,
  exportInteractionMonitoring,
}
