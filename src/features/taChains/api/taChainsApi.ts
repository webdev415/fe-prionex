/**
 * TA Chains API client (KAN-318).
 */

import api from '@/lib/api'
import type {
  TAChain,
  TAChainCreate,
  TAChainListParams,
  TAChainListResponse,
  TAChainUpdate,
} from './types'

const BASE_URL = '/api/v1/ta-chains'

export async function getTAChains(params?: TAChainListParams): Promise<TAChainListResponse> {
  const response = await api.get<TAChainListResponse>(BASE_URL, { params })
  return response.data
}

export async function getTAChain(id: number): Promise<TAChain> {
  const response = await api.get<TAChain>(`${BASE_URL}/${id}`)
  return response.data
}

export async function createTAChain(payload: TAChainCreate): Promise<TAChain> {
  const response = await api.post<TAChain>(BASE_URL, payload)
  return response.data
}

export async function updateTAChain(id: number, payload: TAChainUpdate): Promise<TAChain> {
  const response = await api.put<TAChain>(`${BASE_URL}/${id}`, payload)
  return response.data
}

export async function cloneTAChain(id: number): Promise<TAChain> {
  const response = await api.post<TAChain>(`${BASE_URL}/${id}/clone`)
  return response.data
}

export async function deactivateTAChain(id: number): Promise<TAChain> {
  const response = await api.post<TAChain>(`${BASE_URL}/${id}/deactivate`)
  return response.data
}

export async function activateTAChain(id: number): Promise<TAChain> {
  const response = await api.post<TAChain>(`${BASE_URL}/${id}/activate`)
  return response.data
}

export async function pinTAChain(id: number): Promise<TAChain> {
  const response = await api.post<TAChain>(`${BASE_URL}/${id}/pin`)
  return response.data
}

export async function unpinTAChain(id: number): Promise<TAChain> {
  const response = await api.delete<TAChain>(`${BASE_URL}/${id}/pin`)
  return response.data
}

export async function updateStepPositions(
  chainId: number,
  positions: Array<{ step_id: number; position_x: number; position_y: number }>
): Promise<void> {
  await api.put(`${BASE_URL}/${chainId}/step-positions`, { positions })
}
