/**
 * Types for Payment Import CSV feature.
 */

export type PaymentRowStatus = 'ready' | 'warning' | 'error'

export interface PaymentPreviewRow {
  row_number: number
  loan_number: string
  tin: string | null
  client_name: string | null
  debt_id: number | null
  client_id: number | null
  payment_amount: number
  payment_date: string
  payment_method: string
  payment_type: string | null
  status: PaymentRowStatus
  has_pending_match: boolean | null
  error: string | null
  warning: string | null
}

export interface PaymentPreviewSummary {
  total_rows: number
  ready: number
  warnings: number
  invalid: number
  total_amount: number
  unique_contracts: number
}

export interface PaymentImportPreviewResponse {
  job_id: number
  batch_id: string
  filename: string
  status: string
  total_records: number
  summary: PaymentPreviewSummary
  preview_rows: PaymentPreviewRow[]
  errors: PaymentPreviewRow[]
}

export interface PaymentImportExecuteRequest {
  skip_warnings?: boolean
  comment?: string
}

export interface PaymentImportExecuteResponse {
  job_id: number
  status: string
  message: string
}
