import api from '@/lib/api'
import type {
  ChainInstance,
  ChainInstanceCreate,
  TAInteraction,
  TAInteractionCreate,
  TAInteractionListParams,
  TAInteractionListResponse,
  TAInteractionUpdate,
} from './types'

// TA Interactions
export async function getTAInteractions(
  params?: TAInteractionListParams
): Promise<TAInteractionListResponse> {
  const r = await api.get<TAInteractionListResponse>('/api/v1/ta-interactions', { params })
  return r.data
}

export async function createTAInteraction(payload: TAInteractionCreate): Promise<TAInteraction> {
  const r = await api.post<TAInteraction>('/api/v1/ta-interactions', payload)
  return r.data
}

export async function getTAInteraction(id: number): Promise<TAInteraction> {
  const r = await api.get<TAInteraction>(`/api/v1/ta-interactions/${id}`)
  return r.data
}

export async function updateTAInteraction(
  id: number,
  payload: TAInteractionUpdate
): Promise<TAInteraction> {
  const r = await api.put<TAInteraction>(`/api/v1/ta-interactions/${id}`, payload)
  return r.data
}

export async function togglePinTAInteraction(id: number): Promise<TAInteraction> {
  const r = await api.post<TAInteraction>(`/api/v1/ta-interactions/${id}/pin`)
  return r.data
}

export async function getClientPinnedChainIds(clientId: number): Promise<number[]> {
  const r = await api.get<number[]>(`/api/v1/ta-interactions/clients/${clientId}/pinned-chain-ids`)
  return r.data
}

// Chain Instances
export async function getChainInstances(params?: {
  client_id?: number
  status?: string
}): Promise<ChainInstance[]> {
  const r = await api.get<ChainInstance[]>('/api/v1/chain-instances', { params })
  return r.data
}

export async function startChainInstance(payload: ChainInstanceCreate): Promise<ChainInstance> {
  const r = await api.post<ChainInstance>('/api/v1/chain-instances', payload)
  return r.data
}

export async function completeChainInstance(id: number): Promise<ChainInstance> {
  const r = await api.post<ChainInstance>(`/api/v1/chain-instances/${id}/complete`)
  return r.data
}

export async function advanceChainInstance(
  id: number,
  opts?: { leafNodeId?: number | null; dropdownValueId?: number | null }
): Promise<ChainInstance> {
  const body: Record<string, unknown> = {}
  if (opts?.leafNodeId != null) body.leaf_node_id = opts.leafNodeId
  if (opts?.dropdownValueId != null) body.dropdown_value_id = opts.dropdownValueId
  const r = await api.post<ChainInstance>(
    `/api/v1/chain-instances/${id}/advance`,
    Object.keys(body).length > 0 ? body : undefined
  )
  return r.data
}

export async function cancelChainInstance(id: number): Promise<ChainInstance> {
  const r = await api.post<ChainInstance>(`/api/v1/chain-instances/${id}/cancel`)
  return r.data
}
