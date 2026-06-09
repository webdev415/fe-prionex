import { api } from '@/lib/api'
import type {
  CorrectionStats,
  CorrectionTask,
  CorrectionTaskCreatePayload,
  CorrectionTaskListFilters,
  CorrectionTransitionPayload,
} from '../types/correction'

const BASE = '/api/v1/tasks/correction'

function buildListParams(filters: CorrectionTaskListFilters): URLSearchParams {
  const params = new URLSearchParams()
  filters.operator_ids?.forEach((id) => params.append('operator_ids', String(id)))
  filters.statuses?.forEach((s) => params.append('status', s))
  filters.task_types?.forEach((t) => params.append('task_type', t))
  if (filters.overdue_only) params.set('overdue_only', 'true')
  if (filters.limit != null) params.set('limit', String(filters.limit))
  if (filters.offset != null) params.set('offset', String(filters.offset))
  return params
}

export async function listCorrectionTasks(
  filters: CorrectionTaskListFilters = {}
): Promise<CorrectionTask[]> {
  const response = await api.get<CorrectionTask[]>(BASE, {
    params: buildListParams(filters),
  })
  return response.data
}

export async function createCorrectionTask(
  payload: CorrectionTaskCreatePayload
): Promise<CorrectionTask> {
  const response = await api.post<CorrectionTask>(BASE, payload)
  return response.data
}

export async function transitionCorrectionTask(
  taskId: number,
  payload: CorrectionTransitionPayload
): Promise<CorrectionTask> {
  const response = await api.patch<CorrectionTask>(
    `${BASE}/${taskId}/transition`,
    payload
  )
  return response.data
}

export interface GetStatsFilters {
  operator_id: number
  period_from?: string
  period_to?: string
}

export async function getCorrectionStats(
  filters: GetStatsFilters
): Promise<CorrectionStats> {
  const params = new URLSearchParams()
  params.set('operator_id', String(filters.operator_id))
  if (filters.period_from) params.set('period_from', filters.period_from)
  if (filters.period_to) params.set('period_to', filters.period_to)
  const response = await api.get<CorrectionStats>(`${BASE}/stats`, { params })
  return response.data
}
