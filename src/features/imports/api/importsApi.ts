/**
 * Imports API Client
 *
 * API functions for import operations.
 * Implements all endpoints from /api/v1/import.
 */

import api from '@/lib/api'
import type {
  UploadImportRequest,
  UploadImportResponse,
  ImportJobsListResponse,
  ImportJobsListParams,
  ImportJobDetail,
  ImportErrorsResponse,
  CancelImportResponse,
} from '../types'

/**
 * Upload import file(s)
 *
 * POST /api/v1/import/upload
 * Uploads CSV file(s) or ZIP file for import processing.
 *
 * @param request - Upload request with file(s) and metadata
 * @returns Import job ID and message
 */
export async function uploadImport(request: UploadImportRequest): Promise<UploadImportResponse> {
  const formData = new FormData()

  // Add metadata
  formData.append('seller_creditor', request.seller_creditor)
  formData.append('project_code', request.project_code)
  formData.append('purchase_date', request.purchase_date)
  formData.append('import_type', request.import_type)
  if (request.comment) {
    formData.append('comment', request.comment)
  }

  // Add file(s) based on import type
  if (request.import_type === 'simple') {
    // Simple CSV import - single file (required)
    if (!request.file) {
      throw new Error('File is required for simple import type')
    }
    formData.append('file', request.file)
  } else {
    // Vendor dump - multiple files or ZIP
    if (request.zip_file) {
      formData.append('zip_file', request.zip_file)
    }
    if (request.files && request.files.length > 0) {
      request.files.forEach((file) => {
        formData.append(`files`, file)
      })
    }
  }

  const response = await api.post<UploadImportResponse>('/api/v1/import/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
  return response.data
}

/**
 * Get all import jobs
 *
 * GET /api/v1/import/jobs
 * Fetches paginated list of import jobs with optional filters.
 *
 * @param params - Query parameters for filtering and pagination
 * @returns Paginated list of import jobs
 */
export async function getImportJobs(
  params: ImportJobsListParams = {}
): Promise<ImportJobsListResponse> {
  const response = await api.get<ImportJobsListResponse>('/api/v1/import/jobs', {
    params,
  })
  return response.data
}

/**
 * Get import job detail
 *
 * GET /api/v1/import/jobs/{id}
 * Fetches detailed information about a specific import job.
 *
 * @param jobId - Import job ID
 * @returns Import job detail
 */
export async function getImportJobDetail(jobId: number | string): Promise<ImportJobDetail> {
  const response = await api.get<ImportJobDetail>(`/api/v1/import/jobs/${jobId}`)
  return response.data
}

/**
 * Get import job errors
 *
 * GET /api/v1/import/jobs/{id}/errors
 * Fetches list of errors for a specific import job.
 *
 * @param jobId - Import job ID
 * @param params - Optional pagination parameters
 * @returns List of import errors
 */
export async function getImportJobErrors(
  jobId: number | string,
  params?: { page?: number; page_size?: number }
): Promise<ImportErrorsResponse> {
  const response = await api.get<ImportErrorsResponse>(`/api/v1/import/jobs/${jobId}/errors`, {
    params,
  })
  return response.data
}

/**
 * Export import job errors
 *
 * GET /api/v1/import/jobs/{id}/errors/export
 * Downloads errors as CSV file.
 *
 * @param jobId - Import job ID
 * @returns Blob of CSV file
 */
export async function exportImportJobErrors(jobId: number | string): Promise<Blob> {
  const response = await api.get(`/api/v1/import/jobs/${jobId}/errors/export`, {
    responseType: 'blob',
  })
  return response.data
}

/**
 * Cancel import job
 *
 * POST /api/v1/import/jobs/{id}/cancel
 * Cancels an ongoing or pending import job.
 *
 * @param jobId - Import job ID
 * @returns Success response
 */
export async function cancelImportJob(jobId: number | string): Promise<CancelImportResponse> {
  const response = await api.post<CancelImportResponse>(`/api/v1/import/jobs/${jobId}/cancel`)
  return response.data
}

/**
 * Validate CSV structure
 *
 * POST /api/v1/clients/validate-csv
 * Validates CSV file structure before upload.
 *
 * @param file - CSV file to validate
 * @returns Validation result with missing columns if invalid
 */
export async function validateCSV(file: File): Promise<{
  is_valid: boolean
  missing_columns?: string[]
}> {
  const formData = new FormData()
  formData.append('file', file)

  const response = await api.post<{
    is_valid: boolean
    missing_columns?: string[]
  }>('/api/v1/clients/validate-csv', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
  return response.data
}

/**
 * Exported API object for easier importing
 */
export const importsApi = {
  uploadImport,
  getImportJobs,
  getImportJobDetail,
  getImportJobErrors,
  exportImportJobErrors,
  cancelImportJob,
  validateCSV,
}
