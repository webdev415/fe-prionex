/**
 * UBKI (credit bureau) outbound submission types.
 *
 * Mirrors the backend contract under /api/v1/ubki. The opt-out flag itself
 * lives on the client record (`do_not_send_to_ubki`) and per-credit sent state
 * lives on the debt record (`sent_to_credit_bureau`, `credit_bureau_sent_date`).
 */

export type UbkiSubmitStatus = 'success' | 'error' | 'skipped'

/** Response of POST /api/v1/ubki/debts/{debt_id}/submit */
export interface UbkiSubmitResult {
  debt_id: number
  client_id: number
  status: UbkiSubmitStatus
  ubki_request_id?: string | null
  error_code?: string | null
  error_message?: string | null
}

/** Request body for POST /api/v1/ubki/opt-out/bulk */
export interface UbkiBulkOptOutRequest {
  client_ids: number[]
  do_not_send: boolean
}

/** Response of POST /api/v1/ubki/opt-out/bulk */
export interface UbkiBulkOptOutResponse {
  updated_count: number
  do_not_send: boolean
}

/** Request body for POST /api/v1/ubki/submit/bulk */
export interface UbkiBulkSubmitRequest {
  debt_ids: number[]
}

/** Response of POST /api/v1/ubki/submit/bulk */
export interface UbkiBulkSubmitResponse {
  submitted_count: number
  success_count: number
  error_count: number
  skipped_count: number
  results: UbkiSubmitResult[]
}

/** One row of GET /api/v1/ubki/logs */
export interface UbkiLogEntry {
  id: number
  client_id: number
  debt_id: number
  mode: string
  status: UbkiSubmitStatus
  ubki_request_id?: string | null
  error_code?: string | null
  error_message?: string | null
  triggered_by?: number | null
  created_at: string
}

export interface UbkiLogsParams {
  debt_id?: number
  limit?: number
}
