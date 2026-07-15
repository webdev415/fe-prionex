/**
 * Bulk Document Import API client.
 *
 * Backed by ``import-service`` at ``/api/v1/import/documents``. Currently
 * exposes the example-archive download; upload/processing lands here later.
 */

import { api } from '@/lib/api'

const BASE = '/api/v1/import/documents'

export async function downloadExampleArchive(): Promise<Blob> {
  const response = await api.get(`${BASE}/example-archive`, {
    responseType: 'blob',
  })
  return response.data
}

export const documentImportApi = { downloadExampleArchive }
