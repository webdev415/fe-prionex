/**
 * Client API Service
 * TIN-based brand isolation architecture
 * All queries use direct project_id filtering (NO JOINs on backend)
 * Uses main api client (goes through Kong on port 8000)
 */

import api from '@/lib/api'
import type {
  Client,
  ClientDetail,
  CreateClientRequest,
  GetClientsParams,
  ManualPriorityRequest,
  SearchByTinParams,
  UpdateClientRequest,
} from './types'

const BASE_URL = '/api/v1/clients'

/**
 * Get list of clients for user's active project
 */
export async function getClients(params: GetClientsParams = {}): Promise<Client[]> {
  // Add trailing slash to match FastAPI route definition @router.get("/")
  const response = await api.get<Client[]>(`${BASE_URL}/`, { params })
  return response.data
}

/**
 * Get single client by ID
 * Automatically filtered by user's active project
 */
export async function getClientById(clientId: number): Promise<ClientDetail> {
  const response = await api.get<ClientDetail>(`${BASE_URL}/${clientId}`)
  return response.data
}

/**
 * Create new client with TIN-based brand isolation
 * TIN is MANDATORY (legal requirement for loan issuance)
 */
export async function createClient(clientData: CreateClientRequest): Promise<ClientDetail> {
  // Add trailing slash to match FastAPI route definition @router.post("/")
  const response = await api.post<ClientDetail>(`${BASE_URL}/`, clientData)
  return response.data
}

/**
 * Update client data
 * Note: TIN (tax_id) cannot be changed after creation
 */
export async function updateClient(
  clientId: number,
  clientData: UpdateClientRequest
): Promise<Client> {
  const response = await api.put<Client>(`${BASE_URL}/${clientId}`, clientData)
  return response.data
}

/**
 * Soft delete client
 */
export async function deleteClient(clientId: number): Promise<void> {
  await api.delete(`${BASE_URL}/${clientId}`)
}

/**
 * Search client by TIN within user's project
 * VERY FAST: < 10ms performance (uses idx_clients_tin_project index)
 */
export async function searchByTin(params: SearchByTinParams): Promise<Client | null> {
  const response = await api.get<Client | null>(`${BASE_URL}/search/tin`, {
    params: { tin: params.tin },
  })
  return response.data
}

/**
 * Set manual priority override for a client
 * Requires Supervisor or Admin role
 */
export async function setManualPriority(
  clientId: number,
  priorityData: ManualPriorityRequest
): Promise<Client> {
  const response = await api.post<Client>(`${BASE_URL}/${clientId}/manual-priority`, priorityData)
  return response.data
}

/**
 * Get total client count for user's project
 */
export async function getClientCount(): Promise<number> {
  const response = await api.get<{ count: number }>(`${BASE_URL}/stats/count`)
  return response.data.count
}

/**
 * Exported API object for easier importing
 * Consistent with other service APIs (usersApi, rolesApi, projectsApi, etc.)
 */
export const clientApi = {
  getClients,
  getClientById,
  createClient,
  updateClient,
  deleteClient,
  searchByTin,
  setManualPriority,
  getClientCount,
}
