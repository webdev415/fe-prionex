/**
 * Document Journal API — KAN-403 Tab 1.
 * Hits client-service: GET /api/v1/documents (cross-client listing).
 */

import api from '@/lib/api'
import type { DocumentJournalParams, DocumentJournalResponse } from './types'

const BASE_URL = '/api/v1/documents'

export async function fetchDocumentJournal(
  params: DocumentJournalParams = {}
): Promise<DocumentJournalResponse> {
  const response = await api.get<DocumentJournalResponse>(BASE_URL, {
    params,
    paramsSerializer: { indexes: null },
  })
  return response.data
}
