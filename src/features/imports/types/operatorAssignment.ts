/**
 * Types for Operator Assignment CSV Import feature.
 */

export type OARowStatus = 'ready' | 'no_change' | 'error' | 'warning'

export interface OAPreviewRow {
  row_number: number
  client_id: number
  client_name: string | null
  operator_id: number
  operator_name: string | null
  current_operator_id: number | null
  current_operator_name: string | null
  status: OARowStatus
  error: string | null
  severity: string | null
}

export interface OAPreviewSummary {
  ready: number
  no_change: number
  invalid: number
  unique_operators: number
}

export interface OAPreviewResponse {
  job_id: number
  batch_id: string
  filename: string
  status: string
  total_records: number
  summary: OAPreviewSummary
  preview_rows: OAPreviewRow[]
  errors: OAPreviewRow[]
}

export interface OAExecuteRequest {
  skip_warnings?: boolean
  assignment_reason?: string
}

export interface OAExecuteResponse {
  job_id: number
  status: string
  message: string
}
