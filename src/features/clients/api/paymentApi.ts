/**
 * Payment API Service
 * Calls payment service through Kong gateway
 */

import api from '@/lib/api'
import type { ClientPaymentHistoryResponse } from './types'

const BASE_URL = '/api/v1/payments'

/**
 * Get payment history for a client
 */
export async function getClientPayments(
  clientId: number,
  params: { page?: number; limit?: number } = {}
): Promise<ClientPaymentHistoryResponse> {
  const response = await api.get<ClientPaymentHistoryResponse>(`${BASE_URL}/client/${clientId}`, {
    params,
  })
  return response.data
}

export const paymentApi = {
  getClientPayments,
}
