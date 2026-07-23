/**
 * Document Types API client.
 *
 * CRUD for admin-managed document classification. Backed by
 * ``client-service`` at ``/api/v1/document-types``. All calls are
 * scoped to the caller's active project via JWT.
 */

import { api } from '@/lib/api'
import type {
  DocumentType,
  DocumentTypeCreate,
  DocumentTypeUpdate,
  DocumentTypeVisibilityUpdate,
} from '../types'

const BASE = '/api/v1/document-types'

export async function getDocumentTypes(
  includeHidden = false,
  withCounts = false
): Promise<DocumentType[]> {
  // ``with_counts`` is OFF by default: per-type ``doc_count`` makes the BE
  // aggregate the whole client_documents table. Only the admin management
  // tab opts in; dropdowns/filters/modals must leave it false.
  const response = await api.get<DocumentType[]>(BASE, {
    params: { include_hidden: includeHidden, with_counts: withCounts },
  })
  return response.data
}

export async function createDocumentType(input: DocumentTypeCreate): Promise<DocumentType> {
  const response = await api.post<DocumentType>(BASE, input)
  return response.data
}

export async function updateDocumentType(
  id: number,
  input: DocumentTypeUpdate
): Promise<DocumentType> {
  const response = await api.patch<DocumentType>(`${BASE}/${id}`, input)
  return response.data
}

export async function updateDocumentTypeVisibility(
  id: number,
  input: DocumentTypeVisibilityUpdate
): Promise<DocumentType> {
  const response = await api.patch<DocumentType>(`${BASE}/${id}/visibility`, input)
  return response.data
}

export async function deleteDocumentType(id: number): Promise<void> {
  await api.delete(`${BASE}/${id}`)
}

export const documentTypesApi = {
  list: getDocumentTypes,
  create: createDocumentType,
  update: updateDocumentType,
  updateVisibility: updateDocumentTypeVisibility,
  remove: deleteDocumentType,
}
