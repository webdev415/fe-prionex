/**
 * Operator Assignment API Client
 *
 * API functions for bulk CSV operator assignment.
 */

import api, { getAccessToken } from '@/lib/api'
import type {
  OAPreviewResponse,
  OAExecuteRequest,
  OAExecuteResponse,
} from '../types/operatorAssignment'

/**
 * Upload CSV and get validation preview.
 *
 * POST /api/v1/import/operator-assignment/upload
 */
export async function uploadOperatorAssignment(
  file: File,
  projectId: number
): Promise<OAPreviewResponse> {
  const formData = new FormData()
  formData.append('file', file)

  const token = getAccessToken()
  if (!token) {
    throw new Error('Authentication token is missing. Please log in again.')
  }

  const response = await api.post('/api/v1/import/operator-assignment/upload', formData, {
    params: { project_id: projectId },
    headers: {
      'Content-Type': 'multipart/form-data',
      Authorization: `Bearer ${token}`,
    },
  })

  return response.data
}

/**
 * Execute a validated operator assignment job.
 *
 * POST /api/v1/import/operator-assignment/{jobId}/execute
 */
export async function executeOperatorAssignment(
  jobId: number,
  request: OAExecuteRequest = {}
): Promise<OAExecuteResponse> {
  const response = await api.post(`/api/v1/import/operator-assignment/${jobId}/execute`, request)
  return response.data
}

/**
 * Download CSV template.
 *
 * GET /api/v1/import/operator-assignment/template
 */
export async function downloadOperatorAssignmentTemplate(): Promise<Blob> {
  const response = await api.get('/api/v1/import/operator-assignment/template', {
    responseType: 'blob',
  })
  return response.data
}

export const operatorAssignmentApi = {
  uploadOperatorAssignment,
  executeOperatorAssignment,
  downloadOperatorAssignmentTemplate,
}
