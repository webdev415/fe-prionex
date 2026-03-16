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
  InteractionContactTypeResponse,
  InteractionResultResponse,
  DialHistoryListResponse,
  DialHistoryRecord,
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
 * Create a new interaction.
 * direction and channel are auto-derived by the backend from type_id and subtype_id.
 */
export async function createInteraction(data: {
  client_id: number
  type_id: number
  subtype_id?: number
  contact_type_id?: number
  result_id?: number
  debt_id?: number
  interaction_date?: string
  phone_used?: string
  contact_person?: string
  contact_relationship?: string
  summary?: string
  notes?: string
  promise_to_pay_date?: string
  promise_to_pay_amount?: number
  next_action_date?: string
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
 * List interaction types (Incoming, Outgoing, Searching)
 */
export async function getInteractionTypes(): Promise<InteractionTypeResponse[]> {
  const response = await api.get<InteractionTypeResponse[]>('/api/v1/interaction-types')
  return response.data
}

/**
 * List communication channels (Call, Messenger, Mail, Chat)
 */
export async function getInteractionSubtypes(): Promise<InteractionSubtypeResponse[]> {
  const response = await api.get<InteractionSubtypeResponse[]>('/api/v1/interaction-subtypes')
  return response.data
}

/**
 * List contact types (Client, 3rd Person, Relative)
 */
export async function getInteractionContactTypes(): Promise<InteractionContactTypeResponse[]> {
  const response = await api.get<InteractionContactTypeResponse[]>(
    '/api/v1/interaction-contact-types'
  )
  return response.data
}

/**
 * List results.
 * When type_id is provided, returns only results allowed by interaction_result_rules
 * for the given type + channel + contact_type combination.
 */
export async function getInteractionResults(params?: {
  type_id?: number
  channel_id?: number
  contact_type_id?: number
}): Promise<InteractionResultResponse[]> {
  const response = await api.get<InteractionResultResponse[]>('/api/v1/interaction-results', {
    params,
  })
  return response.data
}

/**
 * List spam call history for a client
 */
export async function getClientDialHistory(
  clientId: number,
  params: { skip?: number; limit?: number } = {}
): Promise<DialHistoryListResponse> {
  const response = await api.get<DialHistoryListResponse>(
    `/api/v1/clients/${clientId}/spam-call-history`,
    { params }
  )
  return response.data
}

export async function addSpamCallHistory(
  clientId: number,
  phone: string
): Promise<DialHistoryRecord> {
  const response = await api.post<DialHistoryRecord>(
    `/api/v1/clients/${clientId}/spam-call-history`,
    { phone }
  )
  return response.data
}

/**
 * Update an existing interaction.
 */
export async function updateInteraction(data: {
  client_id: number
  interaction_id: number
  type_id?: number
  subtype_id?: number
  contact_type_id?: number
  result_id?: number
  summary?: string
  promise_to_pay_date?: string | null
  promise_to_pay_amount?: number | null
  next_action_date?: string | null
}): Promise<InteractionResponse> {
  const { client_id, interaction_id, ...body } = data
  const response = await api.put<InteractionResponse>(
    `/api/v1/clients/${client_id}/interactions/${interaction_id}`,
    body
  )
  return response.data
}

export const interactionApi = {
  getClientInteractions,
  createInteraction,
  updateInteraction,
  getInteractionTypes,
  getInteractionSubtypes,
  getInteractionContactTypes,
  getInteractionResults,
  getClientDialHistory,
  addSpamCallHistory,
}
