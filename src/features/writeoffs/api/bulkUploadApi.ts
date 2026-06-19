/**
 * Bulk write-off upload API (KAN-245 follow-up).
 *
 * POST /api/v1/writeoffs/bulk multipart, returns the per-row response
 * shape defined in REQUIREMENTS §5.6. Header-level CSV failures
 * surface as 400; per-row failures come back inside the 200 body.
 */

import { api } from '@/lib/api'

import type { BulkWriteoffResponse } from './bulkUploadTypes'

export async function uploadWriteoffBulk(file: File): Promise<BulkWriteoffResponse> {
  const formData = new FormData()
  formData.append('file', file)
  const response = await api.post<BulkWriteoffResponse>('/api/v1/writeoffs/bulk', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
  return response.data
}

export const writeoffsBulkApi = {
  uploadWriteoffBulk,
}
