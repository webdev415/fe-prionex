import { api } from '@/lib/api'
import type {
  PageResponse,
  Scorecard,
  ScorecardCreatePayload,
  ScorecardHistoryItem,
  ScorecardListFilters,
  ScorecardTemplate,
  ScorecardUpdatePayload,
} from '../types'

function buildScorecardListParams(filters: ScorecardListFilters): URLSearchParams {
  const params = new URLSearchParams()
  filters.operator_id?.forEach((id) => params.append('operator_id', String(id)))
  filters.trainer_id?.forEach((id) => params.append('trainer_id', String(id)))
  filters.status?.forEach((s) => params.append('status', s))
  if (filters.period) params.set('period', filters.period)
  if (filters.from_date) params.set('from_date', filters.from_date)
  if (filters.to_date) params.set('to_date', filters.to_date)
  if (filters.page != null) params.set('page', String(filters.page))
  if (filters.page_size != null) params.set('page_size', String(filters.page_size))
  return params
}

// ----- Templates -----

export async function listTemplates(includeArchived = false): Promise<ScorecardTemplate[]> {
  const params = includeArchived ? { include_archived: true } : undefined
  const response = await api.get<ScorecardTemplate[]>('/api/v1/quality/templates', {
    params,
  })
  return response.data
}

export async function getTemplate(templateId: number): Promise<ScorecardTemplate> {
  const response = await api.get<ScorecardTemplate>(`/api/v1/quality/templates/${templateId}`)
  return response.data
}

// ----- Scorecards -----

export async function listScorecards(
  filters: ScorecardListFilters
): Promise<PageResponse<Scorecard>> {
  const response = await api.get<PageResponse<Scorecard>>('/api/v1/quality/scorecards', {
    params: buildScorecardListParams(filters),
  })
  return response.data
}

export async function listMyScorecards(
  filters: Pick<ScorecardListFilters, 'period' | 'from_date' | 'to_date' | 'page' | 'page_size'>
): Promise<PageResponse<Scorecard>> {
  const response = await api.get<PageResponse<Scorecard>>('/api/v1/quality/scorecards/me', {
    params: buildScorecardListParams(filters as ScorecardListFilters),
  })
  return response.data
}

export async function getScorecard(scorecardId: number): Promise<Scorecard> {
  const response = await api.get<Scorecard>(`/api/v1/quality/scorecards/${scorecardId}`)
  return response.data
}

export async function getScorecardHistoryForCall(callId: string): Promise<ScorecardHistoryItem[]> {
  const response = await api.get<ScorecardHistoryItem[]>(
    `/api/v1/quality/scorecards/by-call/${callId}/history`
  )
  return response.data
}

export async function createScorecard(payload: ScorecardCreatePayload): Promise<Scorecard> {
  const response = await api.post<Scorecard>('/api/v1/quality/scorecards', payload)
  return response.data
}

export async function updateScorecard(
  scorecardId: number,
  payload: ScorecardUpdatePayload
): Promise<Scorecard> {
  const response = await api.put<Scorecard>(`/api/v1/quality/scorecards/${scorecardId}`, payload)
  return response.data
}

export async function sendScorecard(scorecardId: number): Promise<Scorecard> {
  const response = await api.post<Scorecard>(`/api/v1/quality/scorecards/${scorecardId}/send`)
  return response.data
}

export async function exportScorecards(filters: ScorecardListFilters): Promise<Blob> {
  const response = await api.get<Blob>('/api/v1/quality/scorecards/export', {
    params: buildScorecardListParams(filters),
    responseType: 'blob',
    timeout: 120_000,
  })
  return response.data
}

export const qualityService = {
  listTemplates,
  getTemplate,
  listScorecards,
  listMyScorecards,
  getScorecard,
  getScorecardHistoryForCall,
  createScorecard,
  updateScorecard,
  sendScorecard,
  exportScorecards,
}
