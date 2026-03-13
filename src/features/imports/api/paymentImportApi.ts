/**
 * Payment Import API Client
 *
 * API functions for bulk CSV payment import.
 */

import api, { getAccessToken } from '@/lib/api'
import type {
  PaymentImportPreviewResponse,
  PaymentImportExecuteRequest,
  PaymentImportExecuteResponse,
} from '../types/paymentImport'

/**
 * Upload bank CSV and get validation preview.
 *
 * POST /api/v1/import/payment-import/upload
 */
export async function uploadPaymentImport(
  file: File,
  projectId: number
): Promise<PaymentImportPreviewResponse> {
  const formData = new FormData()
  formData.append('file', file)

  const token = getAccessToken()
  if (!token) {
    throw new Error('Authentication token is missing. Please log in again.')
  }

  const response = await api.post('/api/v1/import/payment-import/upload', formData, {
    params: { project_id: projectId },
    headers: {
      'Content-Type': 'multipart/form-data',
      Authorization: `Bearer ${token}`,
    },
  })

  return response.data
}

/**
 * Execute a validated payment import job.
 *
 * POST /api/v1/import/payment-import/{jobId}/execute
 */
export async function executePaymentImport(
  jobId: number,
  request: PaymentImportExecuteRequest = {}
): Promise<PaymentImportExecuteResponse> {
  const response = await api.post(`/api/v1/import/payment-import/${jobId}/execute`, request)
  return response.data
}

/**
 * Download CSV template for payment import.
 *
 * GET /api/v1/import/payment-import/template
 */
export async function downloadPaymentImportTemplate(): Promise<Blob> {
  const response = await api.get('/api/v1/import/payment-import/template', {
    responseType: 'blob',
  })
  return response.data
}

export const paymentImportApi = {
  uploadPaymentImport,
  executePaymentImport,
  downloadPaymentImportTemplate,
}
