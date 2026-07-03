import { api } from '@/lib/api'
import type {
  AssignDrillPayload,
  AssignDrillResponse,
  AttemptTransitionPayload,
  DrillAttemptCard,
  DrillCardData,
  DrillCreatePayload,
  DrillListFilters,
  DrillListResponse,
  DrillStats,
  DrillUpdatePayload,
  OperatorDrillStats,
  TrainerDrillStats,
} from '../types/drills'

const BASE = '/api/v1/quality/drills'
const ATTEMPTS_BASE = '/api/v1/quality/drill-attempts'

function buildListParams(filters: DrillListFilters): URLSearchParams {
  const params = new URLSearchParams()
  if (filters.status) params.set('status', filters.status)
  if (filters.category) params.set('category', filters.category)
  if (filters.skill_level) params.set('skill_level', filters.skill_level)
  if (filters.q) params.set('q', filters.q)
  if (filters.limit != null) params.set('limit', String(filters.limit))
  if (filters.offset != null) params.set('offset', String(filters.offset))
  return params
}

export async function listDrills(filters: DrillListFilters = {}): Promise<DrillListResponse> {
  const response = await api.get<DrillListResponse>(BASE, {
    params: buildListParams(filters),
  })
  return response.data
}

export async function getDrill(id: number): Promise<DrillCardData> {
  const response = await api.get<DrillCardData>(`${BASE}/${id}`)
  return response.data
}

export async function createDrill(payload: DrillCreatePayload): Promise<DrillCardData> {
  const response = await api.post<DrillCardData>(BASE, payload)
  return response.data
}

export async function updateDrill(id: number, payload: DrillUpdatePayload): Promise<DrillCardData> {
  const response = await api.put<DrillCardData>(`${BASE}/${id}`, payload)
  return response.data
}

export async function archiveDrill(id: number): Promise<void> {
  await api.delete(`${BASE}/${id}`)
}

export async function assignDrill(
  drillId: number,
  payload: AssignDrillPayload
): Promise<AssignDrillResponse> {
  const response = await api.post<AssignDrillResponse>(`${BASE}/${drillId}/assign`, payload)
  return response.data
}

export async function transitionAttempt(
  attemptId: number,
  payload: AttemptTransitionPayload
): Promise<DrillAttemptCard> {
  const response = await api.patch<DrillAttemptCard>(
    `${ATTEMPTS_BASE}/${attemptId}/transition`,
    payload
  )
  return response.data
}

export async function listDrillAttempts(drillId: number): Promise<DrillAttemptCard[]> {
  const response = await api.get<DrillAttemptCard[]>(`${BASE}/${drillId}/attempts`)
  return response.data
}

export async function getDrillStats(drillId: number): Promise<DrillStats> {
  const response = await api.get<DrillStats>(`${BASE}/${drillId}/stats`)
  return response.data
}

export async function getOperatorDrillStats(): Promise<OperatorDrillStats[]> {
  const response = await api.get<OperatorDrillStats[]>(`${BASE}/stats/operators`)
  return response.data
}

export async function getTrainerDrillStats(): Promise<TrainerDrillStats[]> {
  const response = await api.get<TrainerDrillStats[]>(`${BASE}/stats/trainers`)
  return response.data
}

export async function exportDrills(filters: DrillListFilters = {}): Promise<Blob> {
  const response = await api.get<Blob>(`${BASE}/export`, {
    params: buildListParams(filters),
    responseType: 'blob',
    timeout: 120_000,
  })
  return response.data
}
