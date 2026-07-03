/**
 * Call/SMS API Service (Phase 6A)
 * Calls existing call and SMS service endpoints through Kong gateway
 */

import api from '@/lib/api'
import type { CallRecord, SmsRecord } from './types'

/**
 * Get call history for a client
 */
export async function getClientCalls(
  clientId: number,
  params: {
    direction?: string
    status?: string
    date_from?: string
    date_to?: string
    from_date?: string
    to_date?: string
    skip?: number
    limit?: number
  } = {}
): Promise<{ calls: CallRecord[]; total: number }> {
  const response = await api.get(`/api/v1/calls/client/${clientId}`, { params })
  return response.data
}

// Backend SMS response type (differs from frontend SmsRecord)
interface BackendSmsItem {
  message_id: string
  operator_name?: string | null
  message_text?: string | null
  status: string
  sent_at?: string | null
  delivered_at?: string | null
  failed_at?: string | null
  script?: string | null
  sms_segments?: number | null
  cost?: number | null
  template_name?: string | null
}

interface BackendSmsResponse {
  client_id: number
  client_name?: string | null
  total: number
  page: number
  limit: number
  items: BackendSmsItem[]
}

/**
 * Get SMS history for a client
 */
export async function getClientSms(
  clientId: number,
  params: {
    status?: string
    date_from?: string
    date_to?: string
    skip?: number
    limit?: number
  } = {}
): Promise<{ messages: SmsRecord[]; total: number }> {
  const response = await api.get<BackendSmsResponse>(`/api/v1/sms/client/${clientId}`, { params })
  const data = response.data

  // Map backend response to frontend expected format
  const messages = (data.items ?? []).map((item, index) => ({
    id: index + 1, // Backend doesn't return numeric ID, use index
    client_id: data.client_id,
    direction: 'outbound' as const, // SMS service only handles outbound
    phone_number: '', // Not provided by backend
    status: item.status,
    content: item.message_text ?? null,
    template_name: item.template_name ?? null,
    sent_at: item.sent_at ?? null,
    delivered_at: item.delivered_at ?? null,
    created_at: item.sent_at ?? new Date().toISOString(),
    cost: item.cost ?? 0,
    segments: item.sms_segments ?? 1,
    operator_name: item.operator_name ?? null,
  }))

  return { messages, total: data.total }
}

export const callSmsApi = {
  getClientCalls,
  getClientSms,
}
