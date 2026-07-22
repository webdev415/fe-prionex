import { api } from '@/lib/api'
import type {
  AssignmentSummary,
  HeaderKpis,
  HeaderKpisFilters,
  OneOnOneRecord,
  OperatorDetail,
  OperatorDetailFilters,
  QueueFilters,
  QueueResponse,
  ScheduleOneOnOnePayload,
  TakeChargePayload,
  TeamEventsFilters,
  TeamEventsResponse,
  TeamRosterFilters,
  TeamRosterResponse,
  TransitionAssignmentPayload,
} from './types'

const BASE = '/api/v1/quality/coaching'

function buildQueueParams(filters: QueueFilters): URLSearchParams {
  const params = new URLSearchParams()
  filters.user_ids?.forEach((id) => params.append('user_ids', String(id)))
  filters.state?.forEach((s) => params.append('state', s))
  if (filters.period) params.set('period', filters.period)
  if (filters.from_date) params.set('from_date', filters.from_date)
  if (filters.to_date) params.set('to_date', filters.to_date)
  if (filters.page != null) params.set('page', String(filters.page))
  if (filters.page_size != null) params.set('page_size', String(filters.page_size))
  return params
}

function buildHeaderKpisParams(filters: HeaderKpisFilters): URLSearchParams {
  const params = new URLSearchParams()
  filters.user_ids?.forEach((id) => params.append('user_ids', String(id)))
  if (filters.period) params.set('period', filters.period)
  if (filters.from_date) params.set('from_date', filters.from_date)
  if (filters.to_date) params.set('to_date', filters.to_date)
  return params
}

function buildOperatorDetailParams(filters: OperatorDetailFilters): URLSearchParams {
  const params = new URLSearchParams()
  if (filters.period) params.set('period', filters.period)
  if (filters.from_date) params.set('from_date', filters.from_date)
  if (filters.to_date) params.set('to_date', filters.to_date)
  return params
}

export async function getInboxQueue(filters: QueueFilters): Promise<QueueResponse> {
  const response = await api.get<QueueResponse>(`${BASE}/queue`, {
    params: buildQueueParams(filters),
  })
  return response.data
}

export async function getOperatorCoachingDetail(
  filters: OperatorDetailFilters
): Promise<OperatorDetail> {
  const response = await api.get<OperatorDetail>(
    `${BASE}/operators/${filters.operator_id}/detail`,
    { params: buildOperatorDetailParams(filters) }
  )
  return response.data
}

export async function getHeaderKpis(filters: HeaderKpisFilters): Promise<HeaderKpis> {
  const response = await api.get<HeaderKpis>(`${BASE}/header-kpis`, {
    params: buildHeaderKpisParams(filters),
  })
  return response.data
}

/** Operator ids the current trainer has taken under control (active assignment). */
export async function getMyOperators(): Promise<number[]> {
  const response = await api.get<number[]>(`${BASE}/my-operators`)
  return response.data
}

export interface OperatorTrainer {
  operator_id: number
  trainer_id: number
  trainer_name: string
}

/** Assigned trainer (id + name) per operator — the Dialogue "Trainer" column. */
export async function getOperatorTrainers(): Promise<OperatorTrainer[]> {
  const response = await api.get<OperatorTrainer[]>(`${BASE}/operator-trainers`)
  return response.data
}

export async function scheduleOneOnOne(payload: ScheduleOneOnOnePayload): Promise<OneOnOneRecord> {
  const response = await api.post<OneOnOneRecord>(`${BASE}/one-on-ones`, payload)
  return response.data
}

export interface ListOneOnOnesFilters {
  scope?: 'mine' | 'with_me' | 'all'
  upcoming_only?: boolean
  limit?: number
}

export async function transitionAssignment(
  assignmentId: number,
  payload: TransitionAssignmentPayload
): Promise<AssignmentSummary> {
  const response = await api.post<AssignmentSummary>(
    `${BASE}/assignments/${assignmentId}/transition`,
    payload
  )
  return response.data
}

export async function takeChargeOfOperator(payload: TakeChargePayload): Promise<AssignmentSummary> {
  const response = await api.post<AssignmentSummary>(`${BASE}/assignments/take-charge`, payload)
  return response.data
}

function buildTeamEventsParams(filters: TeamEventsFilters): URLSearchParams {
  const params = new URLSearchParams()
  filters.user_ids?.forEach((id) => params.append('user_ids', String(id)))
  if (filters.hours != null) params.set('hours', String(filters.hours))
  if (filters.limit != null) params.set('limit', String(filters.limit))
  return params
}

export async function getTeamEvents(filters: TeamEventsFilters = {}): Promise<TeamEventsResponse> {
  const response = await api.get<TeamEventsResponse>(`${BASE}/team-events`, {
    params: buildTeamEventsParams(filters),
  })
  return response.data
}

function buildTeamRosterParams(filters: TeamRosterFilters): URLSearchParams {
  const params = new URLSearchParams()
  if (filters.department_id != null) {
    params.set('department_id', String(filters.department_id))
  }
  filters.user_ids?.forEach((id) => params.append('user_ids', String(id)))
  return params
}

export async function getTeamRoster(filters: TeamRosterFilters = {}): Promise<TeamRosterResponse> {
  const response = await api.get<TeamRosterResponse>(`${BASE}/team-roster`, {
    params: buildTeamRosterParams(filters),
  })
  return response.data
}

export async function listOneOnOnes(filters: ListOneOnOnesFilters = {}): Promise<OneOnOneRecord[]> {
  const params = new URLSearchParams()
  if (filters.scope) params.set('scope', filters.scope)
  if (filters.upcoming_only != null) params.set('upcoming_only', String(filters.upcoming_only))
  if (filters.limit != null) params.set('limit', String(filters.limit))
  const response = await api.get<OneOnOneRecord[]>(`${BASE}/one-on-ones`, {
    params,
  })
  return response.data
}
