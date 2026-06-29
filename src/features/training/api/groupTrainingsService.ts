import { api } from '@/lib/api'
import type {
  AssignParticipantsResponse,
  GroupTrainingCardData,
  GroupTrainingCreatePayload,
  GroupTrainingListFilters,
  GroupTrainingListResponse,
  GroupTrainingParticipantsResponse,
  GroupTrainingUpdatePayload,
  RegistrationResponse,
} from '../types/groupTrainings'

const BASE = '/api/v1/quality/group-trainings'

function buildListParams(filters: GroupTrainingListFilters): URLSearchParams {
  const params = new URLSearchParams()
  if (filters.status) params.set('status', filters.status)
  if (filters.limit != null) params.set('limit', String(filters.limit))
  if (filters.offset != null) params.set('offset', String(filters.offset))
  return params
}

export async function listGroupTrainings(
  filters: GroupTrainingListFilters = {}
): Promise<GroupTrainingListResponse> {
  const response = await api.get<GroupTrainingListResponse>(BASE, {
    params: buildListParams(filters),
  })
  return response.data
}

export async function getGroupTraining(id: number): Promise<GroupTrainingCardData> {
  const response = await api.get<GroupTrainingCardData>(`${BASE}/${id}`)
  return response.data
}

export async function createGroupTraining(
  payload: GroupTrainingCreatePayload
): Promise<GroupTrainingCardData> {
  const response = await api.post<GroupTrainingCardData>(BASE, payload)
  return response.data
}

export async function updateGroupTraining(
  id: number,
  payload: GroupTrainingUpdatePayload
): Promise<GroupTrainingCardData> {
  const response = await api.put<GroupTrainingCardData>(`${BASE}/${id}`, payload)
  return response.data
}

export async function cancelGroupTraining(id: number): Promise<GroupTrainingCardData> {
  const response = await api.post<GroupTrainingCardData>(`${BASE}/${id}/cancel`)
  return response.data
}

export async function registerForTraining(id: number): Promise<RegistrationResponse> {
  const response = await api.post<RegistrationResponse>(`${BASE}/${id}/register`)
  return response.data
}

export async function unregisterFromTraining(id: number): Promise<RegistrationResponse> {
  const response = await api.delete<RegistrationResponse>(`${BASE}/${id}/register`)
  return response.data
}

export async function listParticipants(id: number): Promise<GroupTrainingParticipantsResponse> {
  const response = await api.get<GroupTrainingParticipantsResponse>(`${BASE}/${id}/participants`)
  return response.data
}

export async function assignParticipants(
  id: number,
  operatorIds: number[]
): Promise<AssignParticipantsResponse> {
  const response = await api.post<AssignParticipantsResponse>(`${BASE}/${id}/assign`, {
    operator_ids: operatorIds,
  })
  return response.data
}

export async function exportGroupTrainings(filters: GroupTrainingListFilters = {}): Promise<Blob> {
  const response = await api.get<Blob>(`${BASE}/export`, {
    params: buildListParams(filters),
    responseType: 'blob',
    timeout: 120_000,
  })
  return response.data
}
