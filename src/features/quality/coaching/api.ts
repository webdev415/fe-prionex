import { api } from '@/lib/api'
import type {
  HeaderKpis,
  HeaderKpisFilters,
  OperatorDetail,
  OperatorDetailFilters,
  QueueFilters,
  QueueResponse,
} from './types'

const BASE = '/api/v1/quality/coaching'

function buildQueueParams(filters: QueueFilters): URLSearchParams {
  const params = new URLSearchParams()
  filters.user_ids?.forEach((id) => params.append('user_ids', String(id)))
  filters.state?.forEach((s) => params.append('state', s))
  if (filters.period) params.set('period', filters.period)
  if (filters.from_date) params.set('from_date', filters.from_date)
  if (filters.to_date) params.set('to_date', filters.to_date)
  if (filters.page != null) params.set('page', String(filters.page))
  if (filters.page_size != null) params.set('page_size', String(filters.page_size))
  return params
}

function buildHeaderKpisParams(filters: HeaderKpisFilters): URLSearchParams {
  const params = new URLSearchParams()
  filters.user_ids?.forEach((id) => params.append('user_ids', String(id)))
  if (filters.period) params.set('period', filters.period)
  if (filters.from_date) params.set('from_date', filters.from_date)
  if (filters.to_date) params.set('to_date', filters.to_date)
  return params
}

function buildOperatorDetailParams(filters: OperatorDetailFilters): URLSearchParams {
  const params = new URLSearchParams()
  if (filters.period) params.set('period', filters.period)
  if (filters.from_date) params.set('from_date', filters.from_date)
  if (filters.to_date) params.set('to_date', filters.to_date)
  return params
}

export async function getInboxQueue(filters: QueueFilters): Promise<QueueResponse> {
  const response = await api.get<QueueResponse>(`${BASE}/queue`, {
    params: buildQueueParams(filters),
  })
  return response.data
}

export async function getOperatorCoachingDetail(
  filters: OperatorDetailFilters
): Promise<OperatorDetail> {
  const response = await api.get<OperatorDetail>(
    `${BASE}/operators/${filters.operator_id}/detail`,
    { params: buildOperatorDetailParams(filters) }
  )
  return response.data
}

export async function getHeaderKpis(filters: HeaderKpisFilters): Promise<HeaderKpis> {
  const response = await api.get<HeaderKpis>(`${BASE}/header-kpis`, {
    params: buildHeaderKpisParams(filters),
  })
  return response.data
}
