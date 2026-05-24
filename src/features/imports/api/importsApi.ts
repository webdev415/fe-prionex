/**
 * Imports API Client
 *
 * API functions for import operations.
 * Implements all endpoints from /api/v1/import.
 */

import api, { getAccessToken } from '@/lib/api'
import type {
  UploadImportRequest,
  UploadImportResponse,
  ImportJobsListResponse,
  ImportJobsListParams,
  ImportJobDetail,
  ImportErrorsResponse,
  CancelImportResponse,
  VendorSchema,
} from '../types'
import {
  transformUploadResponse,
  transformImportJob,
  transformImportJobDetail,
  transformImportError,
  transformCancelResponse,
  wrapInPagination,
} from '../utils/transformers'
import { getProjectIdFromCode } from '../utils/projectHelper'

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
  // Convert project_code to project_id
  const projectId = await getProjectIdFromCode(request.project_code)

  // Get filename from file
  const filename = request.file?.name || request.files?.[0]?.name || 'import.csv'

  // Create FormData with only the file
  const formData = new FormData()

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

  // Add metadata to form data for backend
  if (request.seller_id) {
    formData.append('seller_id', request.seller_id.toString())
  }
  if (request.project_code) {
    formData.append('project_code', request.project_code)
  }
  if (request.purchase_date) {
    formData.append('purchase_date', request.purchase_date)
  }
  if (request.comment) {
    formData.append('comment', request.comment)
  }
  formData.append('import_type', request.import_type)
  if (request.import_type === 'vendor' && request.schema_code) {
    formData.append('schema_code', request.schema_code)
  }

  // Get current token to ensure it's available
  const token = getAccessToken()
  if (!token) {
    throw new Error('Authentication token is missing. Please log in again.')
  }

  // CRITICAL: Explicitly add Authorization header to ensure it's sent
  // The request interceptor should also add it, but we'll add it explicitly as backup
  // For FormData, axios will automatically set Content-Type with boundary, so we don't set it manually
  const response = await api.post('/api/v1/import/upload', formData, {
    params: {
      project_id: projectId,
      filename: filename,
    },
    headers: {
      'Content-Type': 'multipart/form-data',
      Authorization: `Bearer ${token}`, // Explicitly add token to ensure it's sent
      // Don't set Content-Type - axios will set it automatically with boundary for FormData
    },
  })

  // Transform backend response to frontend format
  return transformUploadResponse(response.data)
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
  const page = params.page || 1
  const pageSize = params.page_size || 100

  // Map frontend status to backend status
  let backendStatus: string | undefined
  if (params.status) {
    backendStatus = params.status === 'in_progress' ? 'processing' : params.status
  }

  // Build backend query parameters - send all filter parameters directly
  const backendParams: Record<string, string | number | string[] | undefined> = {
    limit: pageSize,
    offset: (page - 1) * pageSize,
  }

  // Don't send project_id filter - let backend show all jobs from projects user has access to
  // The backend already filters by user_project_ids, so users will see jobs from all their projects
  // If we send project_id, it will filter to only that project, which may hide jobs from other projects

  // Forward user_id so callers can scope to a single uploader. The persistent
  // banner on the Import Clients / Bulk Tag / Bulk Operator pages relies on
  // this to keep itself personal — without it the BE returns every job in the
  // user's accessible projects and the banner could surface another user's
  // running import.
  if (params.user_id !== undefined) {
    backendParams.user_id = params.user_id
  }

  // Add status filter
  if (backendStatus) {
    backendParams.status = backendStatus
  }

  // Add exclude_status filter. Pushed to the backend (not filtered client-side)
  // so rows are excluded BEFORE limit/offset and the count — otherwise a
  // fixed-size page would render fewer than `limit` rows and `total` would
  // overcount. Expand each FE status to the backend status(es) it represents:
  //   'in_progress' -> 'processing'
  //   'pending'     -> 'pending' + 'validated'  (the FE collapses both into
  //                    'pending' via mapStatus, since a 'validated' job is a
  //                    not-yet-executed preview, not finished history)
  if (params.exclude_status && params.exclude_status.length > 0) {
    backendParams.exclude_status = params.exclude_status.flatMap((s) => {
      if (s === 'in_progress') return ['processing']
      if (s === 'pending') return ['pending', 'validated']
      return [s]
    })
  }

  // Add search parameter (filename search)
  if (params.search) {
    backendParams.search = params.search
  }

  // Add uploaded_by filter
  if (params.uploaded_by) {
    backendParams.uploaded_by = params.uploaded_by
  }

  // Add import_type filter
  if (params.import_type) {
    backendParams.import_type = params.import_type
  }

  // Add date range filters
  if (params.date_from) {
    backendParams.date_from = params.date_from
  }
  if (params.date_to) {
    backendParams.date_to = params.date_to
  }

  const response = await api.get('/api/v1/import/jobs', {
    params: backendParams,
    // Serialize array params as repeated keys (exclude_status=processing&
    // exclude_status=pending) — the shape FastAPI's list[...] query expects.
    paramsSerializer: { indexes: null },
  })

  // Backend returns a paginated envelope: { items, total, page, limit }.
  // `total` and `items` already respect exclude_status (filtered server-side),
  // so the FE no longer post-filters — that's what guarantees a full `limit`
  // rows per page and an accurate page count.
  // `items` is typed via the transformer's own parameter to avoid having
  // to export a separate type from transformers.ts.
  const data = response.data as {
    items: Parameters<typeof transformImportJob>[0][]
    total: number
    page: number
    limit: number
  }
  const transformedJobs = (data.items || []).map(transformImportJob)

  return {
    items: transformedJobs,
    total: data.total,
    page: data.page,
    page_size: data.limit,
  }
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
  const response = await api.get(`/api/v1/import/jobs/${jobId}`)

  // Transform backend response to frontend format
  return transformImportJobDetail(response.data)
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
  const limit = params?.page_size || 100
  const offset = params?.page ? (params.page - 1) * limit : 0

  const response = await api.get(`/api/v1/import/jobs/${jobId}/errors`, {
    params: {
      limit,
      offset,
    },
  })

  // Backend now returns paginated object with items and total
  if (response.data && typeof response.data === 'object' && 'items' in response.data) {
    const errors = Array.isArray(response.data.items) ? response.data.items : []
    const transformedErrors = errors.map(transformImportError)
    return {
      items: transformedErrors,
      total: response.data.total || 0,
      page: response.data.page || params?.page || 1,
      page_size: response.data.page_size || params?.page_size || 100,
    }
  }

  // Fallback for old format (array)
  const errors = Array.isArray(response.data) ? response.data : []
  const transformedErrors = errors.map(transformImportError)
  return wrapInPagination(transformedErrors, params?.page || 1, params?.page_size || 100)
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
  const response = await api.post(`/api/v1/import/jobs/${jobId}/cancel`)

  // Transform backend response to frontend format
  return transformCancelResponse(response.data)
}

/**
 * Validate CSV structure
 *
 * NOTE: This endpoint doesn't exist in the backend.
 * CSV validation happens during upload at /api/v1/import/upload.
 * This function is kept for backward compatibility but should not be used.
 *
 * @deprecated Use upload endpoint which validates CSV automatically
 */
export async function validateCSV(_file: File): Promise<{
  is_valid: boolean
  missing_columns?: string[]
}> {
  return {
    is_valid: true,
    missing_columns: [],
  }
}

/**
 * List active vendor-import schemas.
 *
 * GET /api/v1/import/vendor-schemas — returns rows the user can pick on the
 * vendor-upload form. Each row is `{ code, display_name }`; the `code` is the
 * value that gets posted as the `schema_code` form field on upload.
 */
export async function getVendorSchemas(): Promise<VendorSchema[]> {
  const response = await api.get('/api/v1/import/vendor-schemas')
  return Array.isArray(response.data) ? response.data : []
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
  getVendorSchemas,
}
