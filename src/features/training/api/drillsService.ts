import { api } from '@/lib/api'
import type {
  AssignDrillResponse,
  DrillAttemptCard,
  DrillCardData,
  DrillCreatePayload,
  DrillListFilters,
  DrillListResponse,
  DrillUpdatePayload,
} from '../types/drills'

const BASE = '/api/v1/quality/drills'
const ATTEMPTS_BASE = '/api/v1/quality/drill-attempts'

function buildListParams(filters: DrillListFilters): URLSearchParams {
  const params = new URLSearchParams()
  if (filters.status) params.set('status', filters.status)
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

export async function submitAttempt(
  drillId: number,
  payload?: Record<string, unknown> | null
): Promise<DrillAttemptCard> {
  const response = await api.post<DrillAttemptCard>(`${BASE}/${drillId}/attempts`, {
    payload: payload ?? null,
  })
  return response.data
}

export async function scoreAttempt(attemptId: number, score: number): Promise<DrillAttemptCard> {
  const response = await api.post<DrillAttemptCard>(`${ATTEMPTS_BASE}/${attemptId}/score`, {
    score,
  })
  return response.data
}

export async function assignDrill(
  drillId: number,
  operatorIds: number[]
): Promise<AssignDrillResponse> {
  const response = await api.post<AssignDrillResponse>(`${BASE}/${drillId}/assign`, {
    operator_ids: operatorIds,
  })
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
