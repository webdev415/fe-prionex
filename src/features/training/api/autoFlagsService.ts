import { api } from '@/lib/api'
import type {
  AutoFlagRule,
  AutoFlagRuleUpdatePayload,
  FlagEventBulkDismissPayload,
  FlagEventBulkDismissResponse,
  FlagEventCard,
  FlagEventConvertToTaskPayload,
  FlagEventDismissPayload,
  FlagEventListFilters,
  FlagEventListResponse,
} from '../types/autoFlags'

const QUALITY_BASE = '/api/v1/quality'
const ANALYTICS_BASE = '/api/v1/analytics'

function buildListParams(filters: FlagEventListFilters): URLSearchParams {
  const params = new URLSearchParams()
  if (filters.status) params.set('status', filters.status)
  if (filters.rule_code) params.set('rule_code', filters.rule_code)
  filters.operator_id?.forEach((id) => params.append('operator_id', String(id)))
  if (filters.from_date) params.set('from_date', filters.from_date)
  if (filters.to_date) params.set('to_date', filters.to_date)
  if (filters.limit != null) params.set('limit', String(filters.limit))
  if (filters.offset != null) params.set('offset', String(filters.offset))
  return params
}

export async function listFlags(
  filters: FlagEventListFilters = {}
): Promise<FlagEventListResponse> {
  const response = await api.get<FlagEventListResponse>(
    `${QUALITY_BASE}/flags`,
    {
      params: buildListParams(filters),
    }
  )
  return response.data
}

export async function getUnreviewedCount(): Promise<number> {
  const response = await api.get<{ count: number }>(
    `${QUALITY_BASE}/flags/unreviewed-count`
  )
  return response.data.count
}

export async function confirmFlag(flagId: number): Promise<FlagEventCard> {
  const response = await api.post<FlagEventCard>(
    `${QUALITY_BASE}/flags/${flagId}/confirm`
  )
  return response.data
}

export async function dismissFlag(
  flagId: number,
  payload: FlagEventDismissPayload = {}
): Promise<FlagEventCard> {
  const response = await api.post<FlagEventCard>(
    `${QUALITY_BASE}/flags/${flagId}/dismiss`,
    payload
  )
  return response.data
}

export async function bulkDismissFlags(
  payload: FlagEventBulkDismissPayload
): Promise<FlagEventBulkDismissResponse> {
  const response = await api.post<FlagEventBulkDismissResponse>(
    `${QUALITY_BASE}/flags/bulk-dismiss`,
    payload
  )
  return response.data
}

export async function convertFlagToTask(
  flagId: number,
  payload: FlagEventConvertToTaskPayload = {}
): Promise<FlagEventCard> {
  const response = await api.post<FlagEventCard>(
    `${QUALITY_BASE}/flags/${flagId}/convert-to-task`,
    payload
  )
  return response.data
}

export async function listAutoFlagRules(): Promise<AutoFlagRule[]> {
  const response = await api.get<{ data: AutoFlagRule[] }>(
    `${ANALYTICS_BASE}/auto-flag-rules`
  )
  return response.data.data
}

export async function updateAutoFlagRule(
  ruleId: number,
  payload: AutoFlagRuleUpdatePayload
): Promise<AutoFlagRule> {
  const response = await api.put<AutoFlagRule>(
    `${ANALYTICS_BASE}/auto-flag-rules/${ruleId}`,
    payload
  )
  return response.data
}
