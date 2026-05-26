/**
 * Axios bindings for the 5 write-off endpoints (KAN-245).
 *
 * Backend routes (services/client/app/routers/writeoffs_individual.py):
 *   GET    /api/v1/debts/{debt_id}/writeoffs
 *   POST   /api/v1/debts/{debt_id}/writeoffs
 *   GET    /api/v1/writeoffs/{entry_id}
 *   PATCH  /api/v1/writeoffs/{entry_id}
 *   DELETE /api/v1/writeoffs/{entry_id}
 */

import { api } from '@/lib/api'
import type {
  CancelWriteoffRequest,
  CreateWriteoffRequest,
  CreateWriteoffResponse,
  ListWriteoffsParams,
  PaginatedWriteoffsResponse,
  UpdateWriteoffRequest,
  WriteoffEntry,
} from './types'

export async function listWriteoffsForDebt(
  debtId: number,
  params: ListWriteoffsParams = {}
): Promise<PaginatedWriteoffsResponse> {
  const response = await api.get<PaginatedWriteoffsResponse>(`/api/v1/debts/${debtId}/writeoffs`, {
    params,
  })
  return response.data
}

export async function createWriteoffs(
  debtId: number,
  data: CreateWriteoffRequest
): Promise<CreateWriteoffResponse> {
  const response = await api.post<CreateWriteoffResponse>(`/api/v1/debts/${debtId}/writeoffs`, data)
  return response.data
}

export async function getWriteoff(entryId: number): Promise<WriteoffEntry> {
  const response = await api.get<WriteoffEntry>(`/api/v1/writeoffs/${entryId}`)
  return response.data
}

export async function editWriteoff(
  entryId: number,
  data: UpdateWriteoffRequest
): Promise<WriteoffEntry> {
  const response = await api.patch<WriteoffEntry>(`/api/v1/writeoffs/${entryId}`, data)
  return response.data
}

export async function cancelWriteoff(
  entryId: number,
  data: CancelWriteoffRequest = {}
): Promise<WriteoffEntry> {
  const response = await api.delete<WriteoffEntry>(`/api/v1/writeoffs/${entryId}`, { data })
  return response.data
}

export const writeoffsApi = {
  listWriteoffsForDebt,
  createWriteoffs,
  getWriteoff,
  editWriteoff,
  cancelWriteoff,
}
