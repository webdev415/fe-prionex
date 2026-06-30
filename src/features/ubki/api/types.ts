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

/**
 * Request body for POST /api/v1/ubki/submit/by-clients.
 *
 * The backend expands each client to ALL their loans and submits them
 * (opted-out clients are auto-skipped server-side). `client_ids` is capped
 * at 2000 by the backend. Optional `statuses` narrows which loan statuses
 * are submitted.
 */
export interface UbkiBulkSubmitByClientsRequest {
  client_ids: number[]
  statuses?: string[]
}

/**
 * Response of POST /api/v1/ubki/submit/bulk and /api/v1/ubki/submit/by-clients.
 *
 * These endpoints now enqueue a BACKGROUND JOB and return HTTP 202 immediately.
 * The actual per-loan results appear asynchronously in the submission log
 * (GET /api/v1/ubki/logs?batch_id=<batch_id>) as the worker processes them.
 */
export interface UbkiBulkQueuedResponse {
  status: string
  batch_id: string
  queued_count: number
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
  /** Set on rows produced by a background bulk job; groups a single batch. */
  batch_id?: string | null
  created_at: string
}

export interface UbkiLogsParams {
  debt_id?: number
  /** Scope the log to a single background bulk job's rows. */
  batch_id?: string
  limit?: number
}
