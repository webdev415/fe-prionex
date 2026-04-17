import api from '@/lib/api'
import type {
  TADictionaryNode,
  TADictionaryNodeCreate,
  TADictionaryNodeUpdate,
  TADictionaryTreeResponse,
} from './types'

export async function getDictionaryTree(chainId: number): Promise<TADictionaryTreeResponse> {
  const r = await api.get<TADictionaryTreeResponse>(`/api/v1/ta-chains/${chainId}/dictionary`)
  return r.data
}

export async function createDictionaryNode(
  chainId: number,
  payload: TADictionaryNodeCreate
): Promise<TADictionaryNode> {
  const r = await api.post<TADictionaryNode>(`/api/v1/ta-chains/${chainId}/dictionary`, payload)
  return r.data
}

export async function getDictionaryNode(id: number): Promise<TADictionaryNode> {
  const r = await api.get<TADictionaryNode>(`/api/v1/ta-dictionary-nodes/${id}`)
  return r.data
}

export async function updateDictionaryNode(
  id: number,
  payload: TADictionaryNodeUpdate
): Promise<TADictionaryNode> {
  const r = await api.put<TADictionaryNode>(`/api/v1/ta-dictionary-nodes/${id}`, payload)
  return r.data
}

export async function hideDictionaryNode(id: number): Promise<TADictionaryNode> {
  const r = await api.post<TADictionaryNode>(`/api/v1/ta-dictionary-nodes/${id}/hide`)
  return r.data
}

export async function unhideDictionaryNode(id: number): Promise<TADictionaryNode> {
  const r = await api.post<TADictionaryNode>(`/api/v1/ta-dictionary-nodes/${id}/unhide`)
  return r.data
}
