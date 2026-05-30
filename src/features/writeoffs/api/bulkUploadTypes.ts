/**
 * Types for the bulk write-off upload endpoint (KAN-245 follow-up).
 *
 * Matches REQUIREMENTS §5.6 response shape exactly. The backend
 * always returns 200 on a successful parse; per-row outcomes live
 * inside the ``rows`` array. Header-level failures surface as a 400
 * with the ``CSV_HEADER_UNRECOGNISED`` body shape (caller handles
 * that case before unwrapping the success type).
 */

export interface BulkWriteoffSummary {
  rows_in: number
  rows_succeeded: number
  rows_failed: number
  entries_created: number
}

export interface BulkWriteoffRowError {
  code: string
  field?: string
  message?: string
  /** Stable codes such as INSUFFICIENT_BALANCE carry extra context. */
  [key: string]: unknown
}

export interface BulkWriteoffRow {
  row: number
  loan_id: number | null
  loan_number: string | null
  client_id: number | null
  status: 'created' | 'failed'
  entry_ids?: number[]
  errors?: BulkWriteoffRowError[]
}

export interface BulkWriteoffResponse {
  bulk_batch_id: string
  summary: BulkWriteoffSummary
  rows: BulkWriteoffRow[]
}

/**
 * 400 response body shape for a header-level CSV failure.
 * Returned by the backend before any per-row processing.
 */
export interface BulkWriteoffHeaderError {
  code: 'CSV_HEADER_UNRECOGNISED'
  missing: string[]
  unrecognised: string[]
}
