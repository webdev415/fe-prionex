import { api } from '@/lib/api'
import type {
  CallMonitoringFilters,
  CallMonitoringResponse,
  InteractionMonitoringFilters,
  InteractionMonitoringResponse,
  LeakFilters,
  LeaksResponse,
  PromiseCallbackFilters,
  PromisesAndCallbacksResponse,
  ThirdPartyFilters,
  ThirdPartyResponse,
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
  filters.telephony_types?.forEach((t) => {
    if (t) params.append('telephony_types', t)
  })
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
  if (filters.department_id != null) params.set('department_id', String(filters.department_id))
  if (filters.group_id != null) params.set('group_id', String(filters.group_id))
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

function buildPromiseCallbackParams(filters: PromiseCallbackFilters): URLSearchParams {
  // Repeated `?key=val` for list params — FastAPI's
  // `Optional[List[int]] = Query(None)` rejects Axios's default `[]` suffix.
  const params = new URLSearchParams()
  filters.user_ids?.forEach((id) => params.append('user_ids', String(id)))
  if (filters.department_id != null) params.set('department_id', String(filters.department_id))
  if (filters.group_id != null) params.set('group_id', String(filters.group_id))
  if (filters.period) params.set('period', filters.period)
  if (filters.from_datetime) params.set('from_datetime', filters.from_datetime)
  if (filters.to_datetime) params.set('to_datetime', filters.to_datetime)
  if (filters.sort_by) params.set('sort_by', filters.sort_by)
  if (filters.sort_dir) params.set('sort_dir', filters.sort_dir)
  if (filters.page != null) params.set('page', String(filters.page))
  if (filters.page_size != null) params.set('page_size', String(filters.page_size))
  return params
}

export async function getPromisesAndCallbacks(
  filters: PromiseCallbackFilters
): Promise<PromisesAndCallbacksResponse> {
  const response = await api.get<PromisesAndCallbacksResponse>(
    '/api/v1/interactions/promises-and-callbacks',
    { params: buildPromiseCallbackParams(filters) }
  )
  return response.data
}

export async function exportPromisesAndCallbacks(filters: PromiseCallbackFilters): Promise<Blob> {
  const response = await api.get<Blob>('/api/v1/interactions/promises-and-callbacks/export', {
    params: buildPromiseCallbackParams(filters),
    responseType: 'blob',
    timeout: 120_000,
  })
  return response.data
}

function buildLeakParams(filters: LeakFilters): URLSearchParams {
  // Repeated `?key=val` for list params — FastAPI's `Query(None)` rejects
  // Axios's default `[]` suffix.
  const params = new URLSearchParams()
  filters.user_ids?.forEach((id) => params.append('user_ids', String(id)))
  if (filters.department_id != null) params.set('department_id', String(filters.department_id))
  if (filters.group_id != null) params.set('group_id', String(filters.group_id))
  if (filters.period) params.set('period', filters.period)
  if (filters.from_datetime) params.set('from_datetime', filters.from_datetime)
  if (filters.to_datetime) params.set('to_datetime', filters.to_datetime)
  if (filters.lookback_days != null) params.set('lookback_days', String(filters.lookback_days))
  if (filters.follow_up_status) params.set('follow_up_status', filters.follow_up_status)
  if (filters.sort_by) params.set('sort_by', filters.sort_by)
  if (filters.sort_dir) params.set('sort_dir', filters.sort_dir)
  if (filters.page != null) params.set('page', String(filters.page))
  if (filters.page_size != null) params.set('page_size', String(filters.page_size))
  return params
}

export async function getLeaks(filters: LeakFilters): Promise<LeaksResponse> {
  const response = await api.get<LeaksResponse>('/api/v1/interactions/leaks', {
    params: buildLeakParams(filters),
  })
  return response.data
}

export async function exportLeaks(filters: LeakFilters): Promise<Blob> {
  const response = await api.get<Blob>('/api/v1/interactions/leaks/export', {
    params: buildLeakParams(filters),
    responseType: 'blob',
    timeout: 120_000,
  })
  return response.data
}

function buildThirdPartyParams(filters: ThirdPartyFilters): URLSearchParams {
  const params = new URLSearchParams()
  filters.user_ids?.forEach((id) => params.append('user_ids', String(id)))
  if (filters.department_id != null) params.set('department_id', String(filters.department_id))
  if (filters.group_id != null) params.set('group_id', String(filters.group_id))
  if (filters.period) params.set('period', filters.period)
  if (filters.from_datetime) params.set('from_datetime', filters.from_datetime)
  if (filters.to_datetime) params.set('to_datetime', filters.to_datetime)
  if (filters.result_filter) params.set('result_filter', filters.result_filter)
  if (filters.returned_window_hours != null)
    params.set('returned_window_hours', String(filters.returned_window_hours))
  if (filters.sort_by) params.set('sort_by', filters.sort_by)
  if (filters.sort_dir) params.set('sort_dir', filters.sort_dir)
  if (filters.page != null) params.set('page', String(filters.page))
  if (filters.page_size != null) params.set('page_size', String(filters.page_size))
  return params
}

export async function getThirdParty(filters: ThirdPartyFilters): Promise<ThirdPartyResponse> {
  const response = await api.get<ThirdPartyResponse>('/api/v1/interactions/third-party', {
    params: buildThirdPartyParams(filters),
  })
  return response.data
}

export async function exportThirdParty(filters: ThirdPartyFilters): Promise<Blob> {
  const response = await api.get<Blob>('/api/v1/interactions/third-party/export', {
    params: buildThirdPartyParams(filters),
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
  filters.target_action_id_in?.forEach((id) => params.append('target_action_id_in', String(id)))
  filters.step_value_eq?.forEach((v) => params.append('step_value_eq', v))
  filters.step_value_min?.forEach((v) => params.append('step_value_min', v))
  filters.step_value_max?.forEach((v) => params.append('step_value_max', v))
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

import type {
  TaskHistoryAnalyticsFilters,
  TaskHistoryAnalyticsResponse,
  TaskHistoryFilters,
  TaskHistoryResponse,
  TaskSubject,
  WeeklyBucketFilters,
  WeeklyBucketResponse,
} from '../types'

function buildTaskHistoryParams(filters: TaskHistoryFilters): URLSearchParams {
  const params = new URLSearchParams()
  if (filters.date_from) params.set('date_from', filters.date_from)
  if (filters.date_to) params.set('date_to', filters.date_to)
  if (filters.due_date_from) params.set('due_date_from', filters.due_date_from)
  if (filters.due_date_to) params.set('due_date_to', filters.due_date_to)
  filters.assigned_to_user_ids?.forEach((id) => params.append('assigned_to_user_ids', String(id)))
  filters.created_by_in?.forEach((id) => params.append('created_by_in', String(id)))
  if (filters.group_id != null) params.set('group_id', String(filters.group_id))
  if (filters.subject_id != null) params.set('subject_id', String(filters.subject_id))
  if (filters.priority) params.set('priority', filters.priority)
  if (filters.status) params.set('status', filters.status)
  if (filters.sort) params.set('sort', filters.sort)
  if (filters.skip != null) params.set('skip', String(filters.skip))
  if (filters.limit != null) params.set('limit', String(filters.limit))
  return params
}

export async function getTaskHistory(filters: TaskHistoryFilters): Promise<TaskHistoryResponse> {
  const response = await api.get<TaskHistoryResponse>('/api/v1/tasks/history', {
    params: buildTaskHistoryParams(filters),
  })
  return response.data
}

function buildTaskHistoryAnalyticsParams(filters: TaskHistoryAnalyticsFilters): URLSearchParams {
  const params = new URLSearchParams()
  if (filters.date_from) params.set('date_from', filters.date_from)
  if (filters.date_to) params.set('date_to', filters.date_to)
  if (filters.due_date_from) params.set('due_date_from', filters.due_date_from)
  if (filters.due_date_to) params.set('due_date_to', filters.due_date_to)
  filters.assigned_to_user_ids?.forEach((id) => params.append('assigned_to_user_ids', String(id)))
  filters.created_by_in?.forEach((id) => params.append('created_by_in', String(id)))
  if (filters.group_id != null) params.set('group_id', String(filters.group_id))
  if (filters.subject_id != null) params.set('subject_id', String(filters.subject_id))
  if (filters.priority) params.set('priority', filters.priority)
  if (filters.status) params.set('status', filters.status)
  return params
}

export async function getTaskHistoryAnalytics(
  filters: TaskHistoryAnalyticsFilters
): Promise<TaskHistoryAnalyticsResponse> {
  const response = await api.get<TaskHistoryAnalyticsResponse>('/api/v1/tasks/history/analytics', {
    params: buildTaskHistoryAnalyticsParams(filters),
  })
  return response.data
}

export async function listTaskSubjects(): Promise<TaskSubject[]> {
  const response = await api.get<{ subjects: TaskSubject[] }>('/api/v1/tasks/subjects')
  return response.data.subjects ?? []
}

function buildWeeklyBucketParams(filters: WeeklyBucketFilters): URLSearchParams {
  // Repeated `?key=val` for list-shaped filters — FastAPI's
  // `Optional[List[…]] = Query(None)` rejects Axios's default `[]` suffix.
  const params = new URLSearchParams()
  filters.operator_ids?.forEach((id) => params.append('operator_ids', String(id)))
  if (filters.from_date) params.set('from_date', filters.from_date)
  if (filters.to_date) params.set('to_date', filters.to_date)
  filters.status_in?.forEach((s) => params.append('status_in', s))
  filters.priority_in?.forEach((p) => params.append('priority_in', p))
  if (filters.include_no_due_date) params.set('include_no_due_date', 'true')
  return params
}

export async function getWeeklyBucket(filters: WeeklyBucketFilters): Promise<WeeklyBucketResponse> {
  const response = await api.get<WeeklyBucketResponse>('/api/v1/tasks/weekly-bucket', {
    params: buildWeeklyBucketParams(filters),
  })
  return response.data
}

import type { PaymentMonitoringFilters, PaymentMonitoringResponse } from '../types'

function buildPaymentMonitoringParams(filters: PaymentMonitoringFilters): URLSearchParams {
  // Repeated `?key=val` for list-shaped filters — FastAPI's
  // `Optional[List[…]] = Query(None)` rejects Axios's default `[]` suffix.
  const params = new URLSearchParams()
  if (filters.period) params.set('period', filters.period)
  if (filters.from_datetime) params.set('from_datetime', filters.from_datetime)
  if (filters.to_datetime) params.set('to_datetime', filters.to_datetime)
  if (filters.verified_at_from) params.set('verified_at_from', filters.verified_at_from)
  if (filters.verified_at_to) params.set('verified_at_to', filters.verified_at_to)
  if (filters.payment_date_from) params.set('payment_date_from', filters.payment_date_from)
  if (filters.payment_date_to) params.set('payment_date_to', filters.payment_date_to)
  filters.user_ids?.forEach((id) => params.append('user_ids', String(id)))
  filters.payment_method_in?.forEach((m) => params.append('payment_method_in', m))
  filters.status_in?.forEach((s) => params.append('status_in', s))
  filters.payment_type_in?.forEach((t) => params.append('payment_type_in', t))
  if (filters.payment_comment_search && filters.payment_comment_search.trim()) {
    params.set('payment_comment_search', filters.payment_comment_search.trim())
  }
  if (filters.amount_min != null) params.set('amount_min', String(filters.amount_min))
  if (filters.amount_max != null) params.set('amount_max', String(filters.amount_max))
  if (filters.sort) params.set('sort', filters.sort)
  if (filters.page != null) params.set('page', String(filters.page))
  if (filters.limit != null) params.set('limit', String(filters.limit))
  return params
}

export async function getPaymentMonitoring(
  filters: PaymentMonitoringFilters
): Promise<PaymentMonitoringResponse> {
  const response = await api.get<PaymentMonitoringResponse>('/api/v1/payments/monitoring', {
    params: buildPaymentMonitoringParams(filters),
  })
  return response.data
}

import type { ClosureFilters, ClosuresResponse } from '../types'

function buildClosureParams(filters: ClosureFilters): URLSearchParams {
  // Repeated `?key=val` for list-shaped filters — FastAPI's
  // `Optional[List[int]] = Query(None)` rejects Axios's default `[]` suffix.
  const params = new URLSearchParams()
  if (filters.period) params.set('period', filters.period)
  if (filters.from_datetime) params.set('from_datetime', filters.from_datetime)
  if (filters.to_datetime) params.set('to_datetime', filters.to_datetime)
  filters.user_ids?.forEach((id) => params.append('user_ids', String(id)))
  if (filters.sort_by) params.set('sort_by', filters.sort_by)
  if (filters.sort_dir) params.set('sort_dir', filters.sort_dir)
  if (filters.page != null) params.set('page', String(filters.page))
  if (filters.page_size != null) params.set('page_size', String(filters.page_size))
  return params
}

export async function getSuccessfulClosures(filters: ClosureFilters): Promise<ClosuresResponse> {
  const response = await api.get<ClosuresResponse>('/api/v1/payments/closures', {
    params: buildClosureParams(filters),
  })
  return response.data
}

export async function exportSuccessfulClosures(filters: ClosureFilters): Promise<Blob> {
  const response = await api.get<Blob>('/api/v1/payments/closures/export', {
    params: buildClosureParams(filters),
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
  getPromisesAndCallbacks,
  exportPromisesAndCallbacks,
  getLeaks,
  exportLeaks,
  getThirdParty,
  exportThirdParty,
  listInteractionChannels,
  getTaHistory,
  exportTaHistory,
  getTaskHistory,
  getTaskHistoryAnalytics,
  listTaskSubjects,
  getWeeklyBucket,
  getPaymentMonitoring,
  getSuccessfulClosures,
  exportSuccessfulClosures,
}
