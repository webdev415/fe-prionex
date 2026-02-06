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
  delay_reason_id?: number
  refusal_reason_id?: number
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
 * List delay reasons for dropdowns
 */
export async function getDelayReasons(
  activeOnly = true
): Promise<{ delay_reasons: Array<{ id: number; code: string; name: string }> }> {
  const response = await api.get(`${BASE_URL}/delay-reasons`, {
    params: { active_only: activeOnly },
  })
  return response.data
}

/**
 * List refusal reasons for dropdowns
 */
export async function getRefusalReasons(
  activeOnly = true
): Promise<{ refusal_reasons: Array<{ id: number; code: string; name: string }> }> {
  const response = await api.get(`${BASE_URL}/refusal-reasons`, {
    params: { active_only: activeOnly },
  })
  return response.data
}

export const interactionApi = {
  getClientInteractions,
  createInteraction,
  getInteractionTypes,
  getInteractionSubtypes,
  getInteractionResults,
  getDelayReasons,
  getRefusalReasons,
}
