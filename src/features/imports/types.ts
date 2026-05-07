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

// Vendor file logical name — the four CSV/XLSX files in a vendor bundle
export type VendorFileLogical = 'users' | 'credits' | 'payments' | 'write_offs'

// Per-file phase status used by the vendor Import Details panel
export type VendorPhaseStatus = 'pending' | 'in_progress' | 'completed' | 'failed'

// One row of the vendor phase panel — derived from import_options.vendor
export interface VendorFilePhase {
  logical_name: VendorFileLogical
  display_name: string // human label (e.g., "Users", "Credits", "Payments", "Write-offs")
  filename: string // basename from import_options.vendor.bundle[logical_name]
  target_db: string // human label of the downstream DB (e.g., "client-DB clients+debts")
  status: VendorPhaseStatus
  processed?: number
  total?: number
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
  // Vendor flow only — populated from import_options.vendor.* when
  // import_type === 'vendor'. Order matches the receiver's dispatch order.
  vendor_phases?: VendorFilePhase[]
  vendor_error?: string // top-level error string from import_options.error
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
  // Vendor flow only — vendor_schemas.code discriminator. Required when
  // import_type === 'vendor', ignored otherwise.
  schema_code?: string
}

// Vendor schema (from GET /api/v1/import/vendor-schemas)
export interface VendorSchema {
  code: string
  display_name: string
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
