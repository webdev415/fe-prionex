/**
 * Import Response Transformers
 *
 * Transform backend API responses to match frontend type expectations.
 */

import type {
  ImportJob,
  ImportJobDetail,
  ImportJobStatus,
  ImportError,
  // ImportJobsListResponse,
  // ImportErrorsResponse,
  UploadImportResponse,
  CancelImportResponse,
} from '../types'

/**
 * Backend ImportJobResponse type (what backend actually returns)
 */
interface BackendImportJobResponse {
  id: number
  batch_id: string
  project_id: number
  user_id: number
  username: string | null
  filename: string
  file_size: number | null
  file_hash: string | null
  file_path: string | null
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
  total_records: number
  processed_records: number
  successful_records: number
  failed_records: number
  duplicate_records: number
  updated_records: number
  started_at: string | null
  completed_at: string | null
  processing_duration: number | null
  estimated_completion_time: string | null
  import_type: string | null
  import_options: Record<string, unknown> | null
  error_summary: Record<string, unknown> | null
  error_report_path: string | null
  created_at: string
  updated_at: string
}

/**
 * Backend ImportErrorResponse type (what backend actually returns)
 */
interface BackendImportErrorResponse {
  id: number
  job_id: number
  batch_id: string
  line_number: number
  error_type: string
  error_code: string
  error_message: string
  severity: string
  record_data: Record<string, unknown> | null
  suggested_fix: string | null
  created_at: string
}

/**
 * Backend CancelJobResponse type
 */
interface BackendCancelJobResponse {
  id: number
  batch_id: string
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
  message: string
}

/**
 * Map backend status to frontend status
 */
function mapStatus(status: string): ImportJobStatus {
  switch (status) {
    case 'processing':
      return 'in_progress'
    case 'validated':
    case 'pending':
      return 'pending'
    case 'completed':
    case 'failed':
    case 'cancelled':
      return status as ImportJobStatus
    default:
      return 'pending'
  }
}

/**
 * Format processing duration to human-readable string
 */
function formatProcessingTime(durationSeconds: number | null): string {
  if (!durationSeconds) return '0 s'

  const minutes = Math.floor(durationSeconds / 60)
  const seconds = durationSeconds % 60

  if (minutes > 0) {
    return `${minutes} min ${seconds} s`
  }
  return `${seconds} s`
}

/**
 * Calculate progress percentage
 */
function calculateProgressPercentage(processed: number, total: number): number {
  if (total === 0) return 0
  return Math.round((processed / total) * 100)
}

/**
 * Extract metadata from import_options
 */
function extractMetadata(importOptions: Record<string, unknown> | null): {
  import_type?: string
  seller_creditor?: string
  project_code?: string
  purchase_date?: string
  comment?: string
} {
  if (!importOptions) return {}

  return {
    import_type: importOptions.import_type as string | undefined,
    seller_creditor: importOptions.seller_creditor as string | undefined,
    project_code: importOptions.project_code as string | undefined,
    purchase_date: importOptions.purchase_date as string | undefined,
    comment: importOptions.comment as string | undefined,
  }
}

/**
 * Transform backend ImportJobResponse to frontend ImportJob
 */
export function transformImportJob(backend: BackendImportJobResponse): ImportJob {
  const metadata = extractMetadata(backend.import_options)

  return {
    id: backend.id,
    file_name: backend.filename,
    uploaded_by: backend.username || 'Unknown',
    uploaded_at: backend.created_at,
    status: mapStatus(backend.status),
    errors_count: backend.failed_records,
    import_type:
      (backend.import_type as 'simple' | 'vendor' | 'operator_assignment') ||
      (metadata.import_type as 'simple' | 'vendor' | 'operator_assignment') ||
      'simple',
    seller_creditor: metadata.seller_creditor,
    project_code: metadata.project_code,
    purchase_date: metadata.purchase_date,
    comment: metadata.comment,
  }
}

/**
 * Transform backend ImportJobResponse to frontend ImportJobDetail
 */
export function transformImportJobDetail(backend: BackendImportJobResponse): ImportJobDetail {
  const metadata = extractMetadata(backend.import_options)
  const status = mapStatus(backend.status)

  return {
    id: backend.id,
    file_name: backend.filename,
    uploaded_by: backend.username || 'Unknown',
    uploaded_at: backend.created_at,
    status,
    total_rows: backend.total_records,
    new_clients: backend.successful_records, // Assuming successful = new
    updated_clients: backend.updated_records,
    errors_count: backend.failed_records,
    processing_time: formatProcessingTime(backend.processing_duration),
    import_type:
      (backend.import_type as 'simple' | 'vendor' | 'operator_assignment') ||
      (metadata.import_type as 'simple' | 'vendor' | 'operator_assignment') ||
      'simple',
    seller_creditor: metadata.seller_creditor,
    project_code: metadata.project_code,
    purchase_date: metadata.purchase_date,
    comment: metadata.comment,
    progress_percentage:
      status === 'in_progress' || status === 'pending'
        ? ((backend.import_options?.progress_percentage as number | undefined) ??
          calculateProgressPercentage(backend.processed_records, backend.total_records))
        : undefined,
    processing_row: status === 'in_progress' ? backend.processed_records : undefined,
  }
}

/**
 * Transform backend ImportErrorResponse to frontend ImportError
 */
export function transformImportError(backend: BackendImportErrorResponse): ImportError {
  return {
    id: backend.id,
    row: backend.line_number,
    error: backend.error_message,
    column: backend.record_data?.field as string | undefined,
    suggested_fix: backend.suggested_fix || null,
  }
}

/**
 * Transform backend ImportJobResponse to UploadImportResponse
 */
export function transformUploadResponse(backend: BackendImportJobResponse): UploadImportResponse {
  return {
    job_id: backend.id,
    message: 'Import job created successfully',
  }
}

/**
 * Transform backend CancelJobResponse to CancelImportResponse
 */
export function transformCancelResponse(backend: BackendCancelJobResponse): CancelImportResponse {
  return {
    success: true,
    message: backend.message,
  }
}

/**
 * Wrap array response in pagination object
 */
export function wrapInPagination<T>(
  items: T[],
  page: number = 1,
  pageSize: number = 100,
  total?: number // Optional total count (for client-side filtered results)
): { items: T[]; total: number; page: number; page_size: number } {
  return {
    items,
    total: total !== undefined ? total : items.length,
    page,
    page_size: pageSize,
  }
}
