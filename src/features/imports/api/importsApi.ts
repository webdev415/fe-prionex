/**
 * Imports API Client
 *
 * API functions for import operations.
 * Implements all endpoints from /api/v1/import.
 */

import api, { getAccessToken } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'
import type {
  UploadImportRequest,
  UploadImportResponse,
  ImportJobsListResponse,
  ImportJobsListParams,
  ImportJobDetail,
  ImportErrorsResponse,
  CancelImportResponse,
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

  // Store metadata in import_options (backend will need to handle this)
  // For now, we'll pass it as query params or form data that backend can read
  // Actually, backend doesn't accept these, so we'll need to store them client-side
  // or modify backend. Since user said backend is correct, we'll skip metadata for now
  // and only send what backend expects: project_id, filename, and file

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
  // Check if we need client-side filtering
  const needsClientSideFiltering =
    params.exclude_status ||
    params.search ||
    params.uploaded_by ||
    params.date_from ||
    params.date_to ||
    (params.status && params.exclude_status) // Status needs client-side filtering when exclude_status is set

  // If client-side filtering is needed, fetch more items (up to backend max of 1000)
  // Otherwise, use normal pagination
  const page = params.page || 1
  const pageSize = params.page_size || 100

  let limit: number
  let offset: number

  if (needsClientSideFiltering) {
    // Fetch maximum allowed by backend to handle client-side filtering
    limit = 1000
    offset = 0
  } else {
    // Normal pagination
    limit = pageSize
    offset = (page - 1) * pageSize
  }

  // Get active project ID and user ID from auth store
  const user = useAuthStore.getState().user
  const activeProjectId = user?.active_project_id ? parseInt(user.active_project_id, 10) : undefined
  // const userId = user?.id ? parseInt(user.id, 10) : undefined

  // Map frontend status to backend status
  let backendStatus: string | undefined
  if (params.status) {
    // Map 'in_progress' to 'processing'
    backendStatus = params.status === 'in_progress' ? 'processing' : params.status
  }

  // Build backend query parameters (only supported parameters)
  const backendParams: Record<string, string | number | undefined> = {
    limit,
    offset,
  }

  // Add project_id if available (backend expects this for proper filtering)
  if (activeProjectId && !isNaN(activeProjectId)) {
    backendParams.project_id = activeProjectId
  }

  // Don't send user_id - we want to see all users' import histories
  // The backend will return all users' jobs within the project when user_id is not provided
  // (After backend fix: router should not default to current_user.user_id)

  // Add status if specified (but skip if we're using exclude_status - we'll filter client-side)
  if (backendStatus && !params.exclude_status) {
    backendParams.status = backendStatus
  }

  const response = await api.get('/api/v1/import/jobs', {
    params: backendParams,
  })

  // Backend returns array, frontend expects paginated object
  const jobs = Array.isArray(response.data) ? response.data : []
  const transformedJobs = jobs.map(transformImportJob)

  // Apply client-side filters that backend doesn't support
  let filteredJobs = transformedJobs

  // Filter by exclude_status (client-side)
  if (params.exclude_status && params.exclude_status.length > 0) {
    filteredJobs = filteredJobs.filter((job) => !params.exclude_status!.includes(job.status))
  }

  // Filter by status (client-side) - needed when exclude_status is also set
  if (params.status && params.exclude_status) {
    // Map frontend status to match job status
    let targetStatus: string
    if (params.status === 'completed') {
      targetStatus = 'completed'
    } else if (params.status === 'failed') {
      targetStatus = 'failed'
    } else {
      targetStatus = params.status
    }

    filteredJobs = filteredJobs.filter((job) => {
      // Map job status to match filter
      if (targetStatus === 'completed') {
        return job.status === 'completed'
      } else if (targetStatus === 'failed') {
        return job.status === 'failed'
      }
      return job.status === params.status
    })
  }

  // Filter by search (filename) - client-side
  if (params.search) {
    const searchLower = params.search.toLowerCase()
    filteredJobs = filteredJobs.filter((job) => job.file_name.toLowerCase().includes(searchLower))
  }

  // Filter by uploaded_by (username) - client-side
  if (params.uploaded_by) {
    filteredJobs = filteredJobs.filter(
      (job) => job.uploaded_by?.toLowerCase() === params.uploaded_by?.toLowerCase()
    )
  }

  // Filter by date range - client-side
  // Fix: Properly compare dates by comparing actual timestamps against date boundaries
  if (params.date_from || params.date_to) {
    filteredJobs = filteredJobs.filter((job) => {
      // Parse the job's uploaded_at date (ISO string)
      const jobDate = new Date(job.uploaded_at)

      if (params.date_from) {
        // Parse date_from (format: YYYY-MM-DD) and create start of day in UTC
        const fromParts = params.date_from.split('-')
        const fromYear = parseInt(fromParts[0], 10)
        const fromMonth = parseInt(fromParts[1], 10) - 1 // Month is 0-indexed
        const fromDay = parseInt(fromParts[2], 10)

        // Create start of day in UTC for comparison
        const fromDate = new Date(Date.UTC(fromYear, fromMonth, fromDay, 0, 0, 0, 0))

        // Compare actual job date (with time) against start of day
        if (jobDate < fromDate) return false
      }

      if (params.date_to) {
        // Parse date_to (format: YYYY-MM-DD) and create end of day in UTC
        const toParts = params.date_to.split('-')
        const toYear = parseInt(toParts[0], 10)
        const toMonth = parseInt(toParts[1], 10) - 1 // Month is 0-indexed
        const toDay = parseInt(toParts[2], 10)

        // Create end of day in UTC for comparison
        const toDate = new Date(Date.UTC(toYear, toMonth, toDay, 23, 59, 59, 999))

        // Compare actual job date (with time) against end of day
        if (jobDate > toDate) return false
      }

      return true
    })
  }

  // Apply pagination to filtered results if client-side filtering was used
  let paginatedJobs = filteredJobs
  if (needsClientSideFiltering) {
    const startIndex = (page - 1) * pageSize
    const endIndex = startIndex + pageSize
    paginatedJobs = filteredJobs.slice(startIndex, endIndex)
  }

  return wrapInPagination(
    paginatedJobs,
    page,
    pageSize,
    filteredJobs.length // Total count after client-side filtering
  )
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

  // Backend returns array, frontend expects paginated object
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
  // Backend doesn't have a separate validation endpoint
  // Validation happens during upload
  // Return valid by default - actual validation will happen on upload
  console.warn('validateCSV is deprecated. Validation happens during upload.')
  return {
    is_valid: true,
    missing_columns: [],
  }
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
