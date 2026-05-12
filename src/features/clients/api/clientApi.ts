/**
 * Client API Service
 * TIN-based brand isolation architecture
 * All queries use direct project_id filtering (NO JOINs on backend)
 * Uses main api client (goes through Kong on port 8000)
 */

import api from '@/lib/api'
import type {
  AddressResponse,
  AssignClientRequest,
  AssignmentHistoryResponse,
  BulkAssignClientRequest,
  BulkAssignmentResponse,
  Client,
  ClientDetail,
  ClientProfileResponse,
  ContactResponse,
  ContactTypeOption,
  CreateAddressRequest,
  CreateClientRequest,
  CreateContactRequest,
  CreateRestructuringAgreementRequest,
  GetClientsParams,
  ManualPriorityRequest,
  PaginatedClientResponse,
  RestructuringAgreementDetail,
  RestructuringAgreementSummary,
  SearchByTinParams,
  UpdateAddressRequest,
  UpdateClientRequest,
  UpdateContactRequest,
  UpdateEmploymentRequest,
  UpdatePassportRequest,
  WriteoffsResponse,
} from './types'

const BASE_URL = '/api/v1/clients'

/**
 * Get list of clients for user's active project
 */
export async function getClients(params: GetClientsParams = {}): Promise<PaginatedClientResponse> {
  // Add trailing slash to match FastAPI route definition @router.get("/")
  const response = await api.get<PaginatedClientResponse>(`${BASE_URL}/`, { params })
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
 * Priority summary response type
 */
export interface PrioritySummary {
  critical: { count: number; total_debt: string }
  high: { count: number; total_debt: string }
  medium: { count: number; total_debt: string }
  low: { count: number; total_debt: string }
  total: { count: number; total_debt: string }
}

/**
 * Get priority summary with counts and total debt for each priority level
 */
export async function getPrioritySummary(): Promise<PrioritySummary> {
  const response = await api.get<PrioritySummary>(`${BASE_URL}/stats/priority-summary`)
  return response.data
}

/**
 * Assign a client to an employee and/or searcher
 * Requires Admin or Supervisor role
 */
export async function assignClient(
  clientId: number,
  assignmentData: AssignClientRequest
): Promise<Client> {
  const response = await api.post<Client>(`${BASE_URL}/${clientId}/assign`, assignmentData)
  return response.data
}

/**
 * Bulk assign multiple clients to an employee and/or searcher
 * Requires Admin or Supervisor role
 */
export async function bulkAssignClients(
  bulkData: BulkAssignClientRequest
): Promise<BulkAssignmentResponse> {
  const response = await api.post<BulkAssignmentResponse>(`${BASE_URL}/bulk/assign`, bulkData)
  return response.data
}

/**
 * Get client profile (header + left card data)
 */
export async function getClientProfile(clientId: number): Promise<ClientProfileResponse> {
  const response = await api.get<ClientProfileResponse>(`${BASE_URL}/${clientId}/profile`)
  return response.data
}

/**
 * Get client write-offs
 */
export async function getClientWriteoffs(
  clientId: number,
  params: { skip?: number; limit?: number } = {}
): Promise<WriteoffsResponse> {
  const response = await api.get<WriteoffsResponse>(`${BASE_URL}/${clientId}/writeoffs`, { params })
  return response.data
}

/**
 * Get client assignment history
 */
export async function getClientAssignmentHistory(
  clientId: number,
  params: { assignment_type?: string; skip?: number; limit?: number } = {}
): Promise<AssignmentHistoryResponse> {
  const response = await api.get<AssignmentHistoryResponse>(
    `${BASE_URL}/${clientId}/assignment-history`,
    { params }
  )
  return response.data
}

/**
 * Create a new address for a client
 */
export async function createAddress(
  clientId: number,
  data: CreateAddressRequest
): Promise<AddressResponse> {
  const response = await api.post<AddressResponse>(`${BASE_URL}/${clientId}/addresses`, data)
  return response.data
}

/**
 * Update an existing address
 */
export async function updateAddress(
  clientId: number,
  addressId: number,
  data: UpdateAddressRequest
): Promise<AddressResponse> {
  const response = await api.put<AddressResponse>(
    `${BASE_URL}/${clientId}/addresses/${addressId}`,
    data
  )
  return response.data
}

/**
 * Delete an address (soft delete)
 */
export async function deleteAddress(clientId: number, addressId: number): Promise<void> {
  await api.delete(`${BASE_URL}/${clientId}/addresses/${addressId}`)
}

/**
 * Create a new contact for a client
 */
export async function createContact(
  clientId: number,
  data: CreateContactRequest
): Promise<ContactResponse> {
  const response = await api.post<ContactResponse>(`${BASE_URL}/${clientId}/contacts`, data)
  return response.data
}

/**
 * Update an existing contact
 */
export async function updateContact(
  clientId: number,
  contactId: number,
  data: UpdateContactRequest
): Promise<ContactResponse> {
  const response = await api.put<ContactResponse>(
    `${BASE_URL}/${clientId}/contacts/${contactId}`,
    data
  )
  return response.data
}

/**
 * Delete a contact (soft delete)
 */
export async function deleteContact(clientId: number, contactId: number): Promise<void> {
  await api.delete(`${BASE_URL}/${clientId}/contacts/${contactId}`)
}

export async function updateEmployment(
  clientId: number,
  data: UpdateEmploymentRequest
): Promise<void> {
  await api.put(`${BASE_URL}/${clientId}/employment`, data)
}

export async function updatePassport(clientId: number, data: UpdatePassportRequest): Promise<void> {
  await api.put(`${BASE_URL}/${clientId}/passport`, data)
}

/**
 * Get restructuring agreements for a client
 */
export async function getClientRestructuringAgreements(
  clientId: number
): Promise<RestructuringAgreementSummary[]> {
  const response = await api.get<RestructuringAgreementSummary[]>(
    `${BASE_URL}/${clientId}/restructuring-agreements`
  )
  return response.data
}

/**
 * Get restructuring agreement detail for modal
 */
export async function getRestructuringAgreementDetail(
  clientId: number,
  raId: number
): Promise<RestructuringAgreementDetail> {
  const response = await api.get<RestructuringAgreementDetail>(
    `${BASE_URL}/${clientId}/restructuring-agreements/${raId}`
  )
  return response.data
}

/**
 * Create a restructuring agreement for a client
 */
export async function createRestructuringAgreement(
  clientId: number,
  data: CreateRestructuringAgreementRequest
): Promise<{ id: number; status: string }> {
  const response = await api.post<{ id: number; status: string }>(
    `${BASE_URL}/${clientId}/restructuring-agreements`,
    data
  )
  return response.data
}

/**
 * Close a debt (set status to 'closed')
 */
export async function closeDebt(
  clientId: number,
  debtId: number
): Promise<{ id: number; status: string }> {
  const response = await api.patch<{ id: number; status: string }>(
    `${BASE_URL}/${clientId}/debts/${debtId}/close`
  )
  return response.data
}

/**
 * Complete a restructuring agreement (set status_id to 4)
 */
export async function completeRestructuringAgreement(
  clientId: number,
  raId: number
): Promise<{ id: number; status_id: number }> {
  const response = await api.patch<{ id: number; status_id: number }>(
    `${BASE_URL}/${clientId}/restructuring-agreements/${raId}/complete`
  )
  return response.data
}

export interface RRStatusChangeResponse {
  id: number
  status_id: number
  status_name?: string | null
  disconnect_reason?: string | null
}

export interface RRStatusHistoryEntry {
  id: number
  status_id: number
  status_name?: string | null
  change_source: 'manual' | 'auto' | 'disconnect'
  change_reason?: string | null
  changed_by?: number | null
  changed_at: string
}

/**
 * Manual status transition between non-terminal statuses.
 * Allowed targets: 1 Connected, 2 Violated, 3 Cancelled.
 * Backend validates the source→target pair against an allow-list.
 */
export async function transitionRestructuringAgreementStatus(
  clientId: number,
  raId: number,
  payload: { target_status_id: 1 | 2 | 3; reason?: string }
): Promise<RRStatusChangeResponse> {
  const response = await api.patch<RRStatusChangeResponse>(
    `${BASE_URL}/${clientId}/restructuring-agreements/${raId}/transition-status`,
    payload
  )
  return response.data
}

/**
 * Manual disconnect: flips status to Cancelled (3) and stores the
 * operator's reason on `disconnect_reason`. Use case: RR was created
 * by mistake, or the debtor walked back the agreement.
 */
export async function disconnectRestructuringAgreement(
  clientId: number,
  raId: number,
  payload: { reason: string }
): Promise<RRStatusChangeResponse> {
  const response = await api.patch<RRStatusChangeResponse>(
    `${BASE_URL}/${clientId}/restructuring-agreements/${raId}/disconnect`,
    payload
  )
  return response.data
}

/**
 * Newest-first audit log of status changes for one RR.
 */
export async function getRestructuringAgreementStatusHistory(
  clientId: number,
  raId: number
): Promise<RRStatusHistoryEntry[]> {
  const response = await api.get<RRStatusHistoryEntry[]>(
    `${BASE_URL}/${clientId}/restructuring-agreements/${raId}/status-history`
  )
  return response.data
}

export interface OverpaymentResponse {
  id: number
  restructuring_agreement_id: number
  amount: string
  allocation_target: 'next' | 'last'
  recorded_by?: number | null
  reason?: string | null
  created_at: string
}

/**
 * Record an overpayment against an RR. Operator chooses where the
 * excess applies via `allocation_target` ('next' or 'last').
 */
export async function recordRROverpayment(
  clientId: number,
  raId: number,
  payload: {
    amount: number
    allocation_target: 'next' | 'last'
    reason?: string
  }
): Promise<OverpaymentResponse> {
  const response = await api.post<OverpaymentResponse>(
    `${BASE_URL}/${clientId}/restructuring-agreements/${raId}/overpayment`,
    payload
  )
  return response.data
}

/**
 * Newest-first list of overpayments recorded against one RR.
 */
export async function getRROverpayments(
  clientId: number,
  raId: number
): Promise<OverpaymentResponse[]> {
  const response = await api.get<OverpaymentResponse[]>(
    `${BASE_URL}/${clientId}/restructuring-agreements/${raId}/overpayments`
  )
  return response.data
}

/**
 * Get all contact types from the lookup table
 */
export async function getContactTypes(): Promise<ContactTypeOption[]> {
  const response = await api.get<ContactTypeOption[]>(`${BASE_URL}/contact-types`)
  return response.data
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
  getPrioritySummary,
  assignClient,
  bulkAssignClients,
  getClientProfile,
  getClientWriteoffs,
  getClientAssignmentHistory,
  createAddress,
  updateAddress,
  deleteAddress,
  createContact,
  updateContact,
  deleteContact,
  getContactTypes,
  updateEmployment,
  updatePassport,
  getClientRestructuringAgreements,
  getRestructuringAgreementDetail,
  createRestructuringAgreement,
  closeDebt,
  completeRestructuringAgreement,
  transitionRestructuringAgreementStatus,
  disconnectRestructuringAgreement,
  getRestructuringAgreementStatusHistory,
  recordRROverpayment,
  getRROverpayments,
}
