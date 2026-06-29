import { api } from '@/lib/api'
import type {
  AggregateFilters,
  AggregateResponse,
  AlertsResponse,
  CallMarker,
  DynamicsFilters,
  DynamicsResponse,
  Feedback,
  FeedbackCreatePayload,
  FeedbackListFilters,
  FeedbackReply,
  MarkerCreatePayload,
  MarkerListFilters,
  MarkerUpdatePayload,
  PageResponse,
  Scorecard,
  ScorecardCreatePayload,
  ScorecardHistoryItem,
  ScorecardListFilters,
  ScorecardTemplate,
  ScorecardUpdatePayload,
  StageFunnelFilters,
  StageFunnelResponse,
} from '../types'

function buildScorecardListParams(filters: ScorecardListFilters): URLSearchParams {
  const params = new URLSearchParams()
  filters.operator_id?.forEach((id) => params.append('operator_id', String(id)))
  filters.trainer_id?.forEach((id) => params.append('trainer_id', String(id)))
  filters.status?.forEach((s) => params.append('status', s))
  if (filters.period) params.set('period', filters.period)
  if (filters.from_date) params.set('from_date', filters.from_date)
  if (filters.to_date) params.set('to_date', filters.to_date)
  if (filters.page != null) params.set('page', String(filters.page))
  if (filters.page_size != null) params.set('page_size', String(filters.page_size))
  return params
}

// ----- Templates -----

export async function listTemplates(includeArchived = false): Promise<ScorecardTemplate[]> {
  const params = includeArchived ? { include_archived: true } : undefined
  const response = await api.get<ScorecardTemplate[]>('/api/v1/quality/templates', {
    params,
  })
  return response.data
}

export async function getTemplate(templateId: number): Promise<ScorecardTemplate> {
  const response = await api.get<ScorecardTemplate>(`/api/v1/quality/templates/${templateId}`)
  return response.data
}

// ----- Scorecards -----

export async function listScorecards(
  filters: ScorecardListFilters
): Promise<PageResponse<Scorecard>> {
  const response = await api.get<PageResponse<Scorecard>>('/api/v1/quality/scorecards', {
    params: buildScorecardListParams(filters),
  })
  return response.data
}

export async function listMyScorecards(
  filters: Pick<ScorecardListFilters, 'period' | 'from_date' | 'to_date' | 'page' | 'page_size'>
): Promise<PageResponse<Scorecard>> {
  const response = await api.get<PageResponse<Scorecard>>('/api/v1/quality/scorecards/me', {
    params: buildScorecardListParams(filters as ScorecardListFilters),
  })
  return response.data
}

export async function getScorecard(scorecardId: number): Promise<Scorecard> {
  const response = await api.get<Scorecard>(`/api/v1/quality/scorecards/${scorecardId}`)
  return response.data
}

export async function getScorecardHistoryForCall(callId: string): Promise<ScorecardHistoryItem[]> {
  const response = await api.get<ScorecardHistoryItem[]>(
    `/api/v1/quality/scorecards/by-call/${callId}/history`
  )
  return response.data
}

export async function createScorecard(payload: ScorecardCreatePayload): Promise<Scorecard> {
  const response = await api.post<Scorecard>('/api/v1/quality/scorecards', payload)
  return response.data
}

export async function updateScorecard(
  scorecardId: number,
  payload: ScorecardUpdatePayload
): Promise<Scorecard> {
  const response = await api.put<Scorecard>(`/api/v1/quality/scorecards/${scorecardId}`, payload)
  return response.data
}

export async function sendScorecard(scorecardId: number): Promise<Scorecard> {
  const response = await api.post<Scorecard>(`/api/v1/quality/scorecards/${scorecardId}/send`)
  return response.data
}

export async function deleteScorecard(scorecardId: number): Promise<void> {
  await api.delete(`/api/v1/quality/scorecards/${scorecardId}`)
}

export async function exportScorecards(filters: ScorecardListFilters): Promise<Blob> {
  const response = await api.get<Blob>('/api/v1/quality/scorecards/export', {
    params: buildScorecardListParams(filters),
    responseType: 'blob',
    timeout: 120_000,
  })
  return response.data
}

export async function getScorecardAggregate(filters: AggregateFilters): Promise<AggregateResponse> {
  const params = new URLSearchParams()
  if (filters.period) params.set('period', filters.period)
  if (filters.from_date) params.set('from_date', filters.from_date)
  if (filters.to_date) params.set('to_date', filters.to_date)
  if (filters.group_by) params.set('group_by', filters.group_by)
  filters.operator_id?.forEach((id) => params.append('operator_id', String(id)))
  const response = await api.get<AggregateResponse>('/api/v1/quality/scorecards/aggregate', {
    params,
  })
  return response.data
}

export async function getStageFunnel(filters: StageFunnelFilters): Promise<StageFunnelResponse> {
  const params = new URLSearchParams()
  if (filters.period) params.set('period', filters.period)
  if (filters.from_date) params.set('from_date', filters.from_date)
  if (filters.to_date) params.set('to_date', filters.to_date)
  filters.operator_ids?.forEach((id) => params.append('operator_id', String(id)))
  filters.department_ids?.forEach((id) => params.append('department_ids', String(id)))
  const response = await api.get<StageFunnelResponse>('/api/v1/quality/scorecards/stage-funnel', {
    params,
  })
  return response.data
}

// ----- Markers -----

function buildMarkerListParams(filters: MarkerListFilters): URLSearchParams {
  const params = new URLSearchParams()
  filters.operator_id?.forEach((id) => params.append('operator_id', String(id)))
  filters.trainer_id?.forEach((id) => params.append('trainer_id', String(id)))
  filters.marker_type?.forEach((t) => params.append('marker_type', t))
  filters.status?.forEach((s) => params.append('status', s))
  if (filters.period) params.set('period', filters.period)
  if (filters.from_date) params.set('from_date', filters.from_date)
  if (filters.to_date) params.set('to_date', filters.to_date)
  if (filters.page != null) params.set('page', String(filters.page))
  if (filters.page_size != null) params.set('page_size', String(filters.page_size))
  return params
}

export async function listMarkersForCall(callId: string): Promise<CallMarker[]> {
  const response = await api.get<CallMarker[]>(`/api/v1/quality/calls/${callId}/markers`)
  return response.data
}

export async function createMarker(
  callId: string,
  payload: MarkerCreatePayload
): Promise<CallMarker> {
  const response = await api.post<CallMarker>(`/api/v1/quality/calls/${callId}/markers`, payload)
  return response.data
}

export async function updateMarker(
  markerId: number,
  payload: MarkerUpdatePayload
): Promise<CallMarker> {
  const response = await api.put<CallMarker>(`/api/v1/quality/markers/${markerId}`, payload)
  return response.data
}

export async function deleteMarker(markerId: number): Promise<void> {
  await api.delete(`/api/v1/quality/markers/${markerId}`)
}

export async function addMarkerToLibrary(markerId: number): Promise<CallMarker> {
  const response = await api.post<CallMarker>(`/api/v1/quality/markers/${markerId}/add-to-library`)
  return response.data
}

export async function listMarkers(filters: MarkerListFilters): Promise<PageResponse<CallMarker>> {
  const response = await api.get<PageResponse<CallMarker>>('/api/v1/quality/markers', {
    params: buildMarkerListParams(filters),
  })
  return response.data
}

export async function exportMarkers(filters: MarkerListFilters): Promise<Blob> {
  const response = await api.get<Blob>('/api/v1/quality/markers/export', {
    params: buildMarkerListParams(filters),
    responseType: 'blob',
    timeout: 120_000,
  })
  return response.data
}

// ----- Feedback -----

function buildFeedbackListParams(filters: FeedbackListFilters): URLSearchParams {
  const params = new URLSearchParams()
  filters.operator_id?.forEach((id) => params.append('operator_id', String(id)))
  filters.trainer_id?.forEach((id) => params.append('trainer_id', String(id)))
  filters.feedback_type?.forEach((t) => params.append('feedback_type', t))
  filters.status?.forEach((s) => params.append('status', s))
  if (filters.call_id) params.set('call_id', filters.call_id)
  if (filters.period) params.set('period', filters.period)
  if (filters.from_date) params.set('from_date', filters.from_date)
  if (filters.to_date) params.set('to_date', filters.to_date)
  if (filters.page != null) params.set('page', String(filters.page))
  if (filters.page_size != null) params.set('page_size', String(filters.page_size))
  return params
}

export async function listFeedback(filters: FeedbackListFilters): Promise<PageResponse<Feedback>> {
  const response = await api.get<PageResponse<Feedback>>('/api/v1/quality/feedback', {
    params: buildFeedbackListParams(filters),
  })
  return response.data
}

export async function getFeedback(feedbackId: number): Promise<Feedback> {
  const response = await api.get<Feedback>(`/api/v1/quality/feedback/${feedbackId}`)
  return response.data
}

export async function createFeedback(payload: FeedbackCreatePayload): Promise<Feedback> {
  const response = await api.post<Feedback>('/api/v1/quality/feedback', payload)
  return response.data
}

export async function replyToFeedback(feedbackId: number, text: string): Promise<FeedbackReply> {
  const response = await api.post<FeedbackReply>(`/api/v1/quality/feedback/${feedbackId}/replies`, {
    text,
  })
  return response.data
}

export async function markFeedbackRead(feedbackId: number): Promise<Feedback> {
  const response = await api.post<Feedback>(`/api/v1/quality/feedback/${feedbackId}/mark-read`)
  return response.data
}

export async function markFeedbackCompleted(feedbackId: number): Promise<Feedback> {
  const response = await api.post<Feedback>(`/api/v1/quality/feedback/${feedbackId}/complete`)
  return response.data
}

export async function exportFeedback(filters: FeedbackListFilters): Promise<Blob> {
  const response = await api.get<Blob>('/api/v1/quality/feedback/export', {
    params: buildFeedbackListParams(filters),
    responseType: 'blob',
    timeout: 120_000,
  })
  return response.data
}

// ----- Score Dynamics -----

function buildDynamicsParams(filters: DynamicsFilters): URLSearchParams {
  const params = new URLSearchParams()
  if (filters.granularity) params.set('granularity', filters.granularity)
  if (filters.period) params.set('period', filters.period)
  if (filters.from_date) params.set('from_date', filters.from_date)
  if (filters.to_date) params.set('to_date', filters.to_date)
  return params
}

export async function getOperatorDynamics(filters: DynamicsFilters): Promise<DynamicsResponse> {
  const response = await api.get<DynamicsResponse>(
    `/api/v1/quality/dynamics/${filters.operator_id}`,
    { params: buildDynamicsParams(filters) }
  )
  return response.data
}

export async function exportOperatorDynamics(filters: DynamicsFilters): Promise<Blob> {
  const response = await api.get<Blob>(`/api/v1/quality/dynamics/${filters.operator_id}/export`, {
    params: buildDynamicsParams(filters),
    responseType: 'blob',
    timeout: 120_000,
  })
  return response.data
}

export async function listDynamicsAlerts(opts: {
  operator_id?: number
  alert_type?: 'score_drop' | 'consistent_growth'
  limit?: number
}): Promise<AlertsResponse> {
  const params = new URLSearchParams()
  if (opts.operator_id != null) params.set('operator_id', String(opts.operator_id))
  if (opts.alert_type) params.set('alert_type', opts.alert_type)
  if (opts.limit != null) params.set('limit', String(opts.limit))
  const response = await api.get<AlertsResponse>('/api/v1/quality/dynamics/alerts', {
    params,
  })
  return response.data
}

export const qualityService = {
  listTemplates,
  getTemplate,
  listScorecards,
  listMyScorecards,
  getScorecard,
  getScorecardHistoryForCall,
  getScorecardAggregate,
  getStageFunnel,
  createScorecard,
  updateScorecard,
  sendScorecard,
  deleteScorecard,
  exportScorecards,
  listMarkersForCall,
  createMarker,
  updateMarker,
  deleteMarker,
  addMarkerToLibrary,
  listMarkers,
  exportMarkers,
  listFeedback,
  getFeedback,
  createFeedback,
  replyToFeedback,
  markFeedbackRead,
  markFeedbackCompleted,
  exportFeedback,
  getOperatorDynamics,
  exportOperatorDynamics,
  listDynamicsAlerts,
}
