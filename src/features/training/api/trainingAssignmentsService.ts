import { api } from '@/lib/api'
import type { AssignmentFilters, AssignmentListResponse } from '../types/trainingAssignments'

const BASE = '/api/v1/quality/assignments'

function buildParams(filters: AssignmentFilters): URLSearchParams {
  const params = new URLSearchParams()
  if (filters.operator_id != null) params.set('operator_id', String(filters.operator_id))
  return params
}

export async function listAssignments(
  filters: AssignmentFilters = {}
): Promise<AssignmentListResponse> {
  const response = await api.get<AssignmentListResponse>(BASE, {
    params: buildParams(filters),
  })
  return response.data
}

export async function exportAssignments(filters: AssignmentFilters = {}): Promise<Blob> {
  const response = await api.get<Blob>(`${BASE}/export`, {
    params: buildParams(filters),
    responseType: 'blob',
    timeout: 120_000,
  })
  return response.data
}
