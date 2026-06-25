/**
 * Bulk Sale Notes Import API client.
 *
 * Public endpoints live in import-service under /api/v1/import/sale-notes/.
 * The Celery task writes back to client-service via the internal bulk-insert endpoint.
 */

import api, { getAccessToken } from '@/lib/api'
import type { SaleNoteExecuteResponse, SaleNotePreviewResponse } from '../types/saleNotes'

const BASE = '/api/v1/import/sale-notes'

/** Upload CSV/XLSX and get the preview. POST /api/v1/import/sale-notes/upload?project_id=... */
export async function uploadSaleNotes(
  file: File,
  projectId: number
): Promise<SaleNotePreviewResponse> {
  const formData = new FormData()
  formData.append('file', file)

  const token = getAccessToken()
  if (!token) {
    throw new Error('Authentication token is missing. Please log in again.')
  }

  const response = await api.post(`${BASE}/upload`, formData, {
    params: { project_id: projectId },
    headers: {
      'Content-Type': 'multipart/form-data',
      Authorization: `Bearer ${token}`,
    },
  })
  return response.data
}

/** Confirm + queue Celery task. POST /api/v1/import/sale-notes/{job_id}/execute */
export async function executeSaleNotes(jobId: number): Promise<SaleNoteExecuteResponse> {
  const response = await api.post(`${BASE}/${jobId}/execute`, {})
  return response.data
}

/** Download CSV template (header + 1 example row). */
export async function downloadSaleNotesTemplate(): Promise<Blob> {
  const response = await api.get(`${BASE}/template`, {
    responseType: 'blob',
  })
  return response.data
}

export const saleNotesApi = {
  uploadSaleNotes,
  executeSaleNotes,
  downloadSaleNotesTemplate,
}
