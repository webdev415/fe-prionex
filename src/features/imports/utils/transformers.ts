/**
 * Import Response Transformers
 *
 * Transform backend API responses to match frontend type expectations.
 */

import type {
  ImportJob,
  ImportJobDetail,
  ImportJobStatus,
  ImportType,
  ImportError,
  // ImportJobsListResponse,
  // ImportErrorsResponse,
  UploadImportResponse,
  CancelImportResponse,
  TagAssignmentMode,
  VendorFileLogical,
  VendorFilePhase,
  VendorPhaseStatus,
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
  const importType =
    (backend.import_type as ImportType) || (metadata.import_type as ImportType) || 'simple'
  const tagMode =
    importType === 'tag_assignment'
      ? (backend.import_options?.mode as TagAssignmentMode | undefined)
      : undefined

  return {
    id: backend.id,
    file_name: backend.filename,
    uploaded_by: backend.username || 'Unknown',
    uploaded_at: backend.created_at,
    status: mapStatus(backend.status),
    errors_count: backend.failed_records,
    import_type: importType,
    tag_mode: tagMode,
    seller_creditor: metadata.seller_creditor,
    project_code: metadata.project_code,
    purchase_date: metadata.purchase_date,
    comment: metadata.comment,
  }
}

/**
 * Vendor file order matches the receiver's dispatch order (users → credits
 * → payments → write_offs). Display labels and target-DB labels are kept
 * close to the dispatch route so the UI surfaces what the worker actually does.
 */
const VENDOR_PHASE_DISPLAY: Array<{
  logical_name: VendorFileLogical
  display_name: string
  target_db: string
}> = [
  { logical_name: 'users', display_name: 'Users', target_db: 'client-DB clients' },
  { logical_name: 'credits', display_name: 'Credits', target_db: 'client-DB debts' },
  {
    logical_name: 'write_offs',
    display_name: 'Write-offs',
    target_db: 'client-DB debt_writeoffs',
  },
  { logical_name: 'payments', display_name: 'Payments', target_db: 'payment-DB payments' },
]

function basenameFromPath(path: string): string {
  if (!path) return ''
  const parts = path.split('/')
  return parts[parts.length - 1] || path
}

/**
 * Build the per-file phase rows from import_options.vendor.* + the job's
 * top-level status. Mirrors the worker's dispatch order so a 4-row table
 * tells the user where the import got stuck (or how far it got).
 */
function buildVendorPhases(
  importOptions: Record<string, unknown> | null,
  jobStatus: ImportJobStatus
): VendorFilePhase[] | undefined {
  const vendor = importOptions?.vendor as Record<string, unknown> | undefined
  if (!vendor) return undefined

  const bundle = (vendor.bundle as Record<string, string> | undefined) ?? {}
  const filesCompleted = new Set(
    Array.isArray(vendor.files_completed) ? (vendor.files_completed as string[]) : []
  )
  const currentFile = vendor.current_file as string | undefined
  const currentDone = vendor.current_file_records_done as number | undefined
  const currentTotal = vendor.current_file_total_records as number | undefined

  return VENDOR_PHASE_DISPLAY.map(({ logical_name, display_name, target_db }) => {
    const path = bundle[logical_name] || ''
    let status: VendorPhaseStatus
    if (filesCompleted.has(logical_name)) {
      status = 'completed'
    } else if (currentFile === logical_name) {
      // Job ended while this file was the active one — that's where it failed
      status = jobStatus === 'failed' ? 'failed' : 'in_progress'
    } else if (jobStatus === 'completed') {
      // Job completed without listing this file → effectively skipped/done
      status = 'completed'
    } else {
      status = 'pending'
    }

    return {
      logical_name,
      display_name,
      filename: basenameFromPath(path),
      target_db,
      status,
      processed: currentFile === logical_name ? currentDone : undefined,
      total: currentFile === logical_name ? currentTotal : undefined,
    }
  })
}

/**
 * Transform backend ImportJobResponse to frontend ImportJobDetail
 */
export function transformImportJobDetail(backend: BackendImportJobResponse): ImportJobDetail {
  const metadata = extractMetadata(backend.import_options)
  const status = mapStatus(backend.status)
  const importType =
    (backend.import_type as ImportType) || (metadata.import_type as ImportType) || 'simple'
  const tagMode =
    importType === 'tag_assignment'
      ? (backend.import_options?.mode as TagAssignmentMode | undefined)
      : undefined

  return {
    id: backend.id,
    file_name: backend.filename,
    uploaded_by: backend.username || 'Unknown',
    uploaded_at: backend.created_at,
    status,
    total_rows: backend.total_records,
    // Tag-assignment imports don't create or update client records; the
    // "successful" counter from the worker tracks applied (client, tag) pairs,
    // which is what the user wants to see under "Updated Clients" on this
    // page. New Clients is hidden in the page render for this import type.
    new_clients: importType === 'tag_assignment' ? 0 : backend.successful_records,
    updated_clients:
      importType === 'tag_assignment' ? backend.successful_records : backend.updated_records,
    errors_count: backend.failed_records,
    processing_time: formatProcessingTime(backend.processing_duration),
    import_type: importType,
    tag_mode: tagMode,
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
    error_summary: backend.error_summary ?? null,
    vendor_phases:
      importType === 'vendor' ? buildVendorPhases(backend.import_options, status) : undefined,
    vendor_error:
      importType === 'vendor' ? (backend.import_options?.error as string | undefined) : undefined,
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
