/**
 * Per-client sale-notes API client (KAN-617).
 *
 * Endpoints live in client-service:
 *   GET    /api/v1/clients/{client_id}/sale-notes  — list (sorted, project-isolated)
 *   DELETE /api/v1/clients/sale-notes/{note_id}    — hard delete (returns 204)
 *
 * The bulk-upload + history endpoints are separate
 * (`@/features/imports/api/saleNotesApi.ts`).
 */

import api from '@/lib/api'
import type { SaleNote } from '../types/saleNotes'

export async function getSaleNotes(clientId: number): Promise<SaleNote[]> {
  const response = await api.get<SaleNote[]>(`/api/v1/clients/${clientId}/sale-notes`)
  return response.data
}

export async function deleteSaleNote(noteId: number): Promise<void> {
  await api.delete(`/api/v1/clients/sale-notes/${noteId}`)
}

export const saleNotesApi = {
  getSaleNotes,
  deleteSaleNote,
}
