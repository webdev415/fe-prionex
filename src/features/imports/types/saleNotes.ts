/** Types for the Bulk Sale Notes Import feature. */

export type SaleNoteRowStatus = 'ready' | 'error'

export interface SaleNotePreviewRow {
  row_number: number
  client_id: number | null
  client_name: string | null
  sale_date: string | null
  comment_preview: string | null
  status: SaleNoteRowStatus
  error: string | null
}

export interface SaleNotePreviewSummary {
  total: number
  ready: number
  errors: number
  unique_clients: number
}

export interface SaleNotePreviewResponse {
  job_id: number
  batch_id: string
  filename: string
  summary: SaleNotePreviewSummary
  preview_rows: SaleNotePreviewRow[]
  error_rows: SaleNotePreviewRow[]
  preview_rows_truncated: boolean
}

export interface SaleNoteExecuteResponse {
  job_id: number
  status: string
  message: string
}
