/**
 * Tag Assignment API Client
 *
 * API functions for Bulk CSV Tag Assignment / Removal.
 */

import api, { getAccessToken } from '@/lib/api'
import type {
  TagAssignmentMode,
  TagExecuteRequest,
  TagExecuteResponse,
  TagPreviewResponse,
} from '../types/tagAssignment'

/**
 * Upload CSV and get validation preview.
 *
 * POST /api/v1/import/tag-assignment/upload?project_id=...&mode=assign|remove
 */
export async function uploadTagAssignment(
  file: File,
  projectId: number,
  mode: TagAssignmentMode
): Promise<TagPreviewResponse> {
  const formData = new FormData()
  formData.append('file', file)

  const token = getAccessToken()
  if (!token) {
    throw new Error('Authentication token is missing. Please log in again.')
  }

  const response = await api.post('/api/v1/import/tag-assignment/upload', formData, {
    params: { project_id: projectId, mode },
    headers: {
      'Content-Type': 'multipart/form-data',
      Authorization: `Bearer ${token}`,
    },
  })

  return response.data
}

/**
 * Execute a validated tag assignment job.
 *
 * POST /api/v1/import/tag-assignment/{jobId}/execute
 */
export async function executeTagAssignment(
  jobId: number,
  request: TagExecuteRequest = {}
): Promise<TagExecuteResponse> {
  const response = await api.post(`/api/v1/import/tag-assignment/${jobId}/execute`, request)
  return response.data
}

/**
 * Download CSV template.
 *
 * GET /api/v1/import/tag-assignment/template
 */
export async function downloadTagAssignmentTemplate(): Promise<Blob> {
  const response = await api.get('/api/v1/import/tag-assignment/template', {
    responseType: 'blob',
  })
  return response.data
}

export const tagAssignmentApi = {
  uploadTagAssignment,
  executeTagAssignment,
  downloadTagAssignmentTemplate,
}
