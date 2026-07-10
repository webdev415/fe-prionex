/**
 * Axios bindings for the payment reversal / storno endpoints (KAN-334).
 *
 * Backend routes (services/payment/app/routers/reversals.py):
 *   GET  /api/v1/payments/reversals
 *   POST /api/v1/payments/reversals
 *   POST /api/v1/payments/reversals/bulk
 */

import { api } from '@/lib/api'
import type {
  BulkReversalRequest,
  BulkReversalResponse,
  CreateReversalRequest,
  Reversal,
  ReversalListParams,
  ReversalListResponse,
} from './types'

const BASE_URL = '/api/v1/payments/reversals'

export async function listReversals(
  params: ReversalListParams = {}
): Promise<ReversalListResponse> {
  const response = await api.get<ReversalListResponse>(BASE_URL, { params })
  return response.data
}

export async function createReversal(data: CreateReversalRequest): Promise<Reversal> {
  const response = await api.post<Reversal>(BASE_URL, data)
  return response.data
}

export async function bulkReversal(data: BulkReversalRequest): Promise<BulkReversalResponse> {
  const response = await api.post<BulkReversalResponse>(`${BASE_URL}/bulk`, data)
  return response.data
}

export const reversalsApi = {
  listReversals,
  createReversal,
  bulkReversal,
}
