/**
 * Document Templates API — KAN-403 Tab 2.
 * Hits client-service: /api/v1/documents/templates (list/get/create/update/delete).
 */

import api from '@/lib/api'
import type {
  DocumentTemplate,
  DocumentTemplateCreatePayload,
  DocumentTemplateListResponse,
  DocumentTemplateUpdatePayload,
} from './types'

const BASE_URL = '/api/v1/documents/templates'

export async function listDocumentTemplates(
  includeInactive = false
): Promise<DocumentTemplateListResponse> {
  const response = await api.get<DocumentTemplateListResponse>(BASE_URL, {
    params: { include_inactive: includeInactive },
  })
  return response.data
}

export async function getDocumentTemplate(id: number): Promise<DocumentTemplate> {
  const response = await api.get<DocumentTemplate>(`${BASE_URL}/${id}`)
  return response.data
}

export async function createDocumentTemplate(
  payload: DocumentTemplateCreatePayload
): Promise<DocumentTemplate> {
  const response = await api.post<DocumentTemplate>(BASE_URL, payload)
  return response.data
}

export async function updateDocumentTemplate(
  id: number,
  payload: DocumentTemplateUpdatePayload
): Promise<DocumentTemplate> {
  const response = await api.put<DocumentTemplate>(`${BASE_URL}/${id}`, payload)
  return response.data
}

export async function deleteDocumentTemplate(id: number): Promise<void> {
  await api.delete(`${BASE_URL}/${id}`)
}
