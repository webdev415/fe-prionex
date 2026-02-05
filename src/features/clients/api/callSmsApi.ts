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
    skip?: number
    limit?: number
  } = {}
): Promise<{ calls: CallRecord[]; total: number }> {
  const response = await api.get(`/api/v1/calls/client/${clientId}`, { params })
  return response.data
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
  const response = await api.get(`/api/v1/sms/client/${clientId}`, { params })
  return response.data
}

export const callSmsApi = {
  getClientCalls,
  getClientSms,
}
