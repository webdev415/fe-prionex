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
  DocumentTemplateUploadResponse,
  TemplateVariablesResponse,
} from './types'

const BASE_URL = '/api/v1/documents/templates'

/** Content-Type for multipart uploads — axios fills in the boundary itself. */
const MULTIPART_HEADERS = { 'Content-Type': 'multipart/form-data' } as const

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

/**
 * Create a docx-backed template from an uploaded file.
 * `formData` must carry `file` (.docx), `name`, and optionally `description`.
 */
export async function uploadDocumentTemplate(
  formData: FormData
): Promise<DocumentTemplateUploadResponse> {
  const response = await api.post<DocumentTemplateUploadResponse>(`${BASE_URL}/upload`, formData, {
    headers: MULTIPART_HEADERS,
  })
  return response.data
}

/** Replace the .docx file of an existing docx template (re-scans variables). */
export async function replaceDocumentTemplateFile(
  id: number,
  formData: FormData
): Promise<DocumentTemplateUploadResponse> {
  const response = await api.put<DocumentTemplateUploadResponse>(
    `${BASE_URL}/${id}/file`,
    formData,
    { headers: MULTIPART_HEADERS }
  )
  return response.data
}

/** Fetch the raw .docx of a docx template (404 for text templates). */
export async function downloadDocumentTemplateFile(id: number): Promise<Blob> {
  const response = await api.get<Blob>(`${BASE_URL}/${id}/file`, {
    responseType: 'blob',
  })
  return response.data
}

/** Fetch the server-driven catalogue of insertable template variables. */
export async function getDocumentTemplateVariables(): Promise<TemplateVariablesResponse> {
  const response = await api.get<TemplateVariablesResponse>(`${BASE_URL}/variables`)
  return response.data
}
