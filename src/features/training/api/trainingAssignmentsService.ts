import { api } from '@/lib/api'
import type {
  AssignmentFilters,
  AssignmentListResponse,
  AssignmentRow,
} from '../types/trainingAssignments'

const BASE = '/api/v1/quality/course-assignments'

function buildParams(filters: AssignmentFilters): URLSearchParams {
  const params = new URLSearchParams()
  if (filters.operator_id != null) params.set('operator_id', String(filters.operator_id))
  if (filters.status) params.set('status', filters.status)
  if (filters.q) params.set('q', filters.q)
  if (filters.limit != null) params.set('limit', String(filters.limit))
  if (filters.offset != null) params.set('offset', String(filters.offset))
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

export async function updateAssignmentDeadline(
  enrollmentId: number,
  deadline: string | null
): Promise<AssignmentRow> {
  const response = await api.patch<AssignmentRow>(`${BASE}/${enrollmentId}`, { deadline })
  return response.data
}
