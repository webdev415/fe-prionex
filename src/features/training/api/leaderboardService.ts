import { api } from '@/lib/api'
import type {
  BadgeDefinition,
  LeaderboardPeriod,
  LeaderboardResponse,
  ManualBadgeAwardPayload,
  OperatorBadge,
} from '../types/leaderboard'

const BASE = '/api/v1/quality'

export interface GetLeaderboardParams {
  period?: LeaderboardPeriod
  refresh?: boolean
}

export async function getLeaderboard(
  params: GetLeaderboardParams = {}
): Promise<LeaderboardResponse> {
  const search = new URLSearchParams()
  if (params.period) search.set('period', params.period)
  if (params.refresh) search.set('refresh', 'true')
  const response = await api.get<LeaderboardResponse>(`${BASE}/leaderboard`, {
    params: search,
  })
  return response.data
}

export async function getOperatorBadges(
  operatorId: number
): Promise<OperatorBadge[]> {
  const response = await api.get<{ data: OperatorBadge[] }>(
    `${BASE}/operators/${operatorId}/badges`
  )
  return response.data.data
}

export async function listBadgeDefinitions(): Promise<BadgeDefinition[]> {
  const response = await api.get<{ data: BadgeDefinition[] }>(
    `${BASE}/badges/definitions`
  )
  return response.data.data
}

export async function awardBadgeManually(
  payload: ManualBadgeAwardPayload
): Promise<OperatorBadge> {
  const response = await api.post<OperatorBadge>(`${BASE}/badges/award`, payload)
  return response.data
}

export function leaderboardExportUrl(period: LeaderboardPeriod): string {
  return `${BASE}/leaderboard/export.xlsx?period=${period}`
}
