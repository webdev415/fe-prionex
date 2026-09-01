/**
 * Contact Tag Assignment API Client
 *
 * API functions for the Contact Tags bulk import (assign / remove).
 */

import api, { getAccessToken } from '@/lib/api'
import type {
  ContactTagAssignmentMode,
  ContactTagAssignmentPreviewResponse,
  ContactTagExecuteRequest,
  ContactTagExecuteResponse,
} from '../types/contactTagAssignment'

/**
 * Upload CSV/XLSX and get the validation preview. Writes nothing.
 *
 * POST /api/v1/import/contact-tag-assignment/upload?project_id=...&mode=assign|remove
 */
export async function uploadContactTagAssignment(
  file: File,
  projectId: number,
  mode: ContactTagAssignmentMode
): Promise<ContactTagAssignmentPreviewResponse> {
  const formData = new FormData()
  formData.append('file', file)

  const token = getAccessToken()
  if (!token) {
    throw new Error('Authentication token is missing. Please log in again.')
  }

  const response = await api.post('/api/v1/import/contact-tag-assignment/upload', formData, {
    params: { project_id: projectId, mode },
    headers: {
      'Content-Type': 'multipart/form-data',
      Authorization: `Bearer ${token}`,
    },
  })

  return response.data
}

/**
 * Execute a validated contact tag job.
 *
 * POST /api/v1/import/contact-tag-assignment/{jobId}/execute
 */
export async function executeContactTagAssignment(
  jobId: number,
  request: ContactTagExecuteRequest = {}
): Promise<ContactTagExecuteResponse> {
  const response = await api.post(`/api/v1/import/contact-tag-assignment/${jobId}/execute`, request)
  return response.data
}

export const contactTagAssignmentApi = {
  uploadContactTagAssignment,
  executeContactTagAssignment,
}
