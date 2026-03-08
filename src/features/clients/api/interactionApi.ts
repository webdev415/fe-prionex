/**
 * Interaction API Service
 * Calls client service through Kong gateway
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
    page?: number
    page_size?: number
  } = {}
): Promise<InteractionListResponse> {
  const response = await api.get<InteractionListResponse>(
    `/api/v1/clients/${clientId}/interactions`,
    { params }
  )
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
  const { client_id, ...body } = data
  const response = await api.post<InteractionResponse>(
    `/api/v1/clients/${client_id}/interactions`,
    body
  )
  return response.data
}

/**
 * List interaction types for dropdowns
 */
export async function getInteractionTypes(): Promise<InteractionTypeResponse[]> {
  const response = await api.get<InteractionTypeResponse[]>('/api/v1/interaction-types')
  return response.data
}

/**
 * List interaction subtypes for dropdowns
 */
export async function getInteractionSubtypes(
  typeId?: number
): Promise<InteractionSubtypeResponse[]> {
  const response = await api.get<InteractionSubtypeResponse[]>('/api/v1/interaction-subtypes', {
    params: typeId !== undefined ? { type_id: typeId } : undefined,
  })
  return response.data
}

/**
 * List interaction results for dropdowns
 */
export async function getInteractionResults(): Promise<InteractionResultResponse[]> {
  const response = await api.get<InteractionResultResponse[]>('/api/v1/interaction-results')
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
    `/api/v1/clients/${clientId}/dial-history`,
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
