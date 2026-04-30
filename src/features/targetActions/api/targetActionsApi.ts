/**
 * Target Actions API client (KAN-317).
 * All requests go through Kong → client-service.
 */

import api from '@/lib/api'
import type {
  TargetAction,
  TargetActionCreate,
  TargetActionListParams,
  TargetActionListResponse,
  TargetActionUpdate,
} from './types'

const BASE_URL = '/api/v1/target-actions'

export async function getTargetActions(
  params?: TargetActionListParams
): Promise<TargetActionListResponse> {
  const response = await api.get<TargetActionListResponse>(BASE_URL, { params })
  return response.data
}

export async function getTargetAction(id: number): Promise<TargetAction> {
  const response = await api.get<TargetAction>(`${BASE_URL}/${id}`)
  return response.data
}

export async function createTargetAction(payload: TargetActionCreate): Promise<TargetAction> {
  const response = await api.post<TargetAction>(BASE_URL, payload)
  return response.data
}

export async function updateTargetAction(
  id: number,
  payload: TargetActionUpdate
): Promise<TargetAction> {
  const response = await api.put<TargetAction>(`${BASE_URL}/${id}`, payload)
  return response.data
}

export async function cloneTargetAction(id: number): Promise<TargetAction> {
  const response = await api.post<TargetAction>(`${BASE_URL}/${id}/clone`)
  return response.data
}

export async function hideTargetAction(id: number): Promise<TargetAction> {
  const response = await api.post<TargetAction>(`${BASE_URL}/${id}/hide`)
  return response.data
}

export async function unhideTargetAction(id: number): Promise<TargetAction> {
  const response = await api.post<TargetAction>(`${BASE_URL}/${id}/unhide`)
  return response.data
}
