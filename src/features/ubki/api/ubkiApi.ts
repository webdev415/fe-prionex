/**
 * UBKI (credit bureau) outbound submission API client.
 * All calls go through Kong on port 8000.
 */

import api from '@/lib/api'
import type {
  UbkiBulkOptOutRequest,
  UbkiBulkOptOutResponse,
  UbkiBulkQueuedResponse,
  UbkiBulkSubmitByClientsRequest,
  UbkiBulkSubmitRequest,
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
 * Bulk submit multiple credits/debts to UBKI. Enqueues a background job and
 * returns HTTP 202 immediately; per-loan results land async in the submission
 * log (GET /logs?batch_id=<batch_id>).
 */
export async function bulkSubmitToUbki(
  data: UbkiBulkSubmitRequest
): Promise<UbkiBulkQueuedResponse> {
  const response = await api.post<UbkiBulkQueuedResponse>(`${BASE_URL}/submit/bulk`, data)
  return response.data
}

/**
 * Bulk submit to UBKI by clients. The backend expands each client to ALL
 * their loans and submits them (opted-out clients auto-skipped server-side).
 * Enqueues a background job and returns HTTP 202 immediately; per-loan results
 * land async in the submission log (GET /logs?batch_id=<batch_id>).
 */
export async function bulkSubmitByClients(
  data: UbkiBulkSubmitByClientsRequest
): Promise<UbkiBulkQueuedResponse> {
  const response = await api.post<UbkiBulkQueuedResponse>(`${BASE_URL}/submit/by-clients`, data)
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
  bulkSubmitByClients,
  getUbkiLogs,
}
