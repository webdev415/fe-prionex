/**
 * Document Templates API — KAN-403 Tab 2.
 * Hits client-service: /api/v1/documents/templates (list/get/create/update/delete).
 */

import api from '@/lib/api'
import type {
  DocumentTemplate,
  DocumentTemplateCreatePayload,
  DocumentTemplateListResponse,
  DocumentTemplateTagOption,
  DocumentTemplateUpdatePayload,
  DocumentTemplateUploadResponse,
  TemplateVariablesResponse,
} from './types'

const BASE_URL = '/api/v1/documents/templates'

/**
 * Tags selectable for the `tag_active` activation rule. Served from
 * client-service so the ids match the space the generation check uses
 * (client_db `tags.id`). Live tags for the caller's project, sorted by name.
 */
export async function getDocumentTemplateTagOptions(): Promise<DocumentTemplateTagOption[]> {
  const response = await api.get<DocumentTemplateTagOption[]>(`${BASE_URL}/tag-options`)
  return response.data
}

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

export type TemplateFileFormat = 'docx' | 'pdf'

/**
 * Fetch a docx template's file (404 for text templates).
 * `format: 'pdf'` returns the server-rendered PDF — pixel-identical to what
 * generation produces (used for in-browser preview).
 */
export async function downloadDocumentTemplateFile(
  id: number,
  format: TemplateFileFormat = 'docx'
): Promise<Blob> {
  const response = await api.get<Blob>(`${BASE_URL}/${id}/file`, {
    params: format === 'pdf' ? { format } : undefined,
    responseType: 'blob',
  })
  return response.data
}

/**
 * Fetch the .docx of a docx template rendered with sample data — the server
 * substitutes the same engine future generation will use, so lawyers can see
 * whether anything shifts once real values fill the placeholders.
 * 404 for text templates.
 */
export async function previewDocumentTemplateFile(
  id: number,
  format: TemplateFileFormat = 'docx'
): Promise<Blob> {
  const response = await api.get<Blob>(`${BASE_URL}/${id}/file/preview`, {
    params: format === 'pdf' ? { format } : undefined,
    responseType: 'blob',
  })
  return response.data
}

/** Fetch the server-driven catalogue of insertable template variables. */
export async function getDocumentTemplateVariables(): Promise<TemplateVariablesResponse> {
  const response = await api.get<TemplateVariablesResponse>(`${BASE_URL}/variables`)
  return response.data
}

export interface DocumentTemplateComposePayload {
  name: string
  description?: string | null
  /** Title lines, split by \n. */
  title: string
  /** Body paragraphs, split by newlines. */
  body: string
  include_schedule: boolean
  include_requisites: boolean
  activation_rule?: string
  /** Required client_db tag id when activation_rule is `tag_active`. */
  activation_tag_id?: number | null
  document_type_id?: number | null
}

/**
 * Compose a branded template from structured input: the corporate static
 * (letterhead, requisites, stamp/signature footer) is fixed server-side —
 * the author supplies only title/body and block toggles.
 */
export async function composeDocumentTemplate(
  payload: DocumentTemplateComposePayload
): Promise<DocumentTemplateUploadResponse> {
  const response = await api.post<DocumentTemplateUploadResponse>(`${BASE_URL}/compose`, payload)
  return response.data
}
