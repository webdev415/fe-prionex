/**
 * UBKI (credit bureau) outbound submission API client.
 * All calls go through Kong on port 8000.
 */

import api from '@/lib/api'
import type {
  UbkiBulkOptOutRequest,
  UbkiBulkOptOutResponse,
  UbkiBulkSubmitRequest,
  UbkiBulkSubmitResponse,
  UbkiLogEntry,
  UbkiLogsParams,
  UbkiSubmitResult,
} from './types'

const BASE_URL = '/api/v1/ubki'

/**
 * Manually submit a single credit/debt to UBKI.
 */
export async function submitDebtToUbki(debtId: number): Promise<UbkiSubmitResult> {
  const response = await api.post<UbkiSubmitResult>(`${BASE_URL}/debts/${debtId}/submit`)
  return response.data
}

/**
 * Bulk opt-out (or re-enable) clients from UBKI submission.
 */
export async function bulkOptOutUbki(data: UbkiBulkOptOutRequest): Promise<UbkiBulkOptOutResponse> {
  const response = await api.post<UbkiBulkOptOutResponse>(`${BASE_URL}/opt-out/bulk`, data)
  return response.data
}

/**
 * Bulk submit multiple credits/debts to UBKI.
 */
export async function bulkSubmitToUbki(
  data: UbkiBulkSubmitRequest
): Promise<UbkiBulkSubmitResponse> {
  const response = await api.post<UbkiBulkSubmitResponse>(`${BASE_URL}/submit/bulk`, data)
  return response.data
}

/**
 * Submission history log (newest first), optionally scoped to one debt.
 */
export async function getUbkiLogs(params: UbkiLogsParams = {}): Promise<UbkiLogEntry[]> {
  const response = await api.get<UbkiLogEntry[]>(`${BASE_URL}/logs`, { params })
  return response.data
}

export const ubkiApi = {
  submitDebtToUbki,
  bulkOptOutUbki,
  bulkSubmitToUbki,
  getUbkiLogs,
}
