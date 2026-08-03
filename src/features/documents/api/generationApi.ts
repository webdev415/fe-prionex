/**
 * Document Generation API — generate a legal document from a template on a
 * client's card (client-service).
 *
 *   GET  /api/v1/documents/generation-options?client_id=X
 *   POST /api/v1/documents/templates/{template_id}/generate
 *
 * The generate call persists a PDF into the client's documents (so the list
 * refetch shows it) and returns a base64 .docx twin for optional download.
 */

import api from '@/lib/api'
import type {
  GenerateDocumentPayload,
  GenerateDocumentResponse,
  GenerationOptionsResponse,
} from './types'

const BASE_URL = '/api/v1/documents'

/** Fetch which templates are available for each of a client's debts. */
export async function getGenerationOptions(clientId: number): Promise<GenerationOptionsResponse> {
  const response = await api.get<GenerationOptionsResponse>(`${BASE_URL}/generation-options`, {
    params: { client_id: clientId },
  })
  return response.data
}

/** Generate a document from a template for a specific debt. */
export async function generateDocument(
  templateId: number,
  payload: GenerateDocumentPayload
): Promise<GenerateDocumentResponse> {
  const response = await api.post<GenerateDocumentResponse>(
    `${BASE_URL}/templates/${templateId}/generate`,
    payload
  )
  return response.data
}
