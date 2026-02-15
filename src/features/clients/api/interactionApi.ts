/**
 * Interaction API Service
 * Calls interaction service through Kong gateway
 */

import api from '@/lib/api'
import type {
  InteractionListResponse,
  InteractionResponse,
  InteractionTypeResponse,
  InteractionSubtypeResponse,
  InteractionResultResponse,
  DialHistoryListResponse,
} from './types'

const BASE_URL = '/api/v1/interactions'

/**
 * List interactions for a client
 */
export async function getClientInteractions(
  clientId: number,
  params: {
    channel?: string
    direction?: string
    type_id?: number
    date_from?: string
    date_to?: string
    skip?: number
    limit?: number
  } = {}
): Promise<InteractionListResponse> {
  const response = await api.get<InteractionListResponse>(`${BASE_URL}/client/${clientId}`, {
    params,
  })
  return response.data
}

/**
 * Create a new interaction
 */
export async function createInteraction(data: {
  client_id: number
  type_id: number
  direction: string
  channel: string
  debt_id?: number
  subtype_id?: number
  result_id?: number
  interaction_date?: string
  phone_used?: string
  contact_person?: string
  summary?: string
  notes?: string
  promise_to_pay_date?: string
  promise_to_pay_amount?: number
  follow_up_required?: boolean
  follow_up_date?: string
  related_call_id?: number
  related_sms_id?: number
  related_payment_id?: number
}): Promise<InteractionResponse> {
  const response = await api.post<InteractionResponse>(BASE_URL + '/', data)
  return response.data
}

/**
 * List interaction types for dropdowns
 */
export async function getInteractionTypes(
  activeOnly = true
): Promise<{ types: InteractionTypeResponse[] }> {
  const response = await api.get<{ types: InteractionTypeResponse[] }>(`${BASE_URL}/types`, {
    params: { active_only: activeOnly },
  })
  return response.data
}

/**
 * List interaction subtypes for dropdowns
 */
export async function getInteractionSubtypes(
  typeId?: number,
  activeOnly = true
): Promise<{ subtypes: InteractionSubtypeResponse[] }> {
  const response = await api.get<{ subtypes: InteractionSubtypeResponse[] }>(
    `${BASE_URL}/subtypes`,
    { params: { type_id: typeId, active_only: activeOnly } }
  )
  return response.data
}

/**
 * List interaction results for dropdowns
 */
export async function getInteractionResults(
  activeOnly = true
): Promise<{ results: InteractionResultResponse[] }> {
  const response = await api.get<{ results: InteractionResultResponse[] }>(`${BASE_URL}/results`, {
    params: { active_only: activeOnly },
  })
  return response.data
}

/**
 * List dial history for a client
 */
export async function getClientDialHistory(
  clientId: number,
  params: { skip?: number; limit?: number } = {}
): Promise<DialHistoryListResponse> {
  const response = await api.get<DialHistoryListResponse>(
    `${BASE_URL}/dial-history/client/${clientId}`,
    { params }
  )
  return response.data
}

export const interactionApi = {
  getClientInteractions,
  createInteraction,
  getInteractionTypes,
  getInteractionSubtypes,
  getInteractionResults,
  getClientDialHistory,
}
