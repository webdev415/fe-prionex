/**
 * Import Types
 *
 * Type definitions for import-related API responses and data structures.
 */

// Import Job Status
export type ImportJobStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled'

// Import Type
export type ImportType = 'simple' | 'vendor' | 'operator_assignment' | 'payment_import'

// Import Job (from GET /api/import/jobs)
export interface ImportJob {
  id: number | string
  file_name: string
  uploaded_by: string
  uploaded_at: string // ISO datetime string
  status: ImportJobStatus
  errors_count: number
  import_type: ImportType
  seller_creditor?: string // Seller code for display (from job metadata)
  project_code?: string
  purchase_date?: string
  comment?: string
}

// Import Job Detail (from GET /api/import/jobs/{id})
export interface ImportJobDetail {
  id: number | string
  file_name: string
  uploaded_by: string
  uploaded_at: string // ISO datetime string
  status: ImportJobStatus
  total_rows: number
  new_clients: number
  updated_clients: number
  errors_count: number
  processing_time: string // e.g., "7 min 42 s"
  import_type: ImportType
  seller_creditor?: string // Seller code for display (from job metadata)
  project_code?: string
  purchase_date?: string
  comment?: string
  progress_percentage?: number // 0-100, only for in_progress
  processing_row?: number // Current row being processed, only for in_progress
  error_summary?: Record<string, unknown> | string | null // Error details on failure
}

// Import Error (from GET /api/import/jobs/{id}/errors)
export interface ImportError {
  id: number
  row: number
  error: string
  column?: string
  suggested_fix?: string | null
}

// Import Jobs List Response (from GET /api/import/jobs)
export interface ImportJobsListResponse {
  items: ImportJob[]
  total: number
  page: number
  page_size: number
}

// Import Jobs List Params
export interface ImportJobsListParams {
  page?: number
  page_size?: number
  search?: string // Search by filename
  status?: ImportJobStatus
  uploaded_by?: string
  date_from?: string // ISO date string
  date_to?: string // ISO date string
  exclude_status?: ImportJobStatus[] // Exclude jobs with these statuses
  import_type?: ImportType // Filter by import type
}

// Upload Import Request
export interface UploadImportRequest {
  file?: File // For simple CSV (required for simple import type)
  files?: File[] // For vendor dump (multiple CSVs)
  zip_file?: File // For vendor dump (ZIP with documents)
  seller_id: number
  project_code: string
  purchase_date: string
  comment?: string
  import_type: ImportType
}

// Upload Import Response
export interface UploadImportResponse {
  job_id: number | string
  message: string
}

// Import Errors Response (from GET /api/import/jobs/{id}/errors)
export interface ImportErrorsResponse {
  items: ImportError[]
  total: number
  page?: number
  page_size?: number
}

// Cancel Import Response
export interface CancelImportResponse {
  success: boolean
  message: string
}
