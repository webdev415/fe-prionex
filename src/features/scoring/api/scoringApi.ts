/**
 * Scoring v3 (priority) API client.
 *
 * Calls the scoring service through Kong (`/api/v1/v3-score/*`). The active
 * project id is part of the path; auth + active-project come from the shared
 * `api` instance interceptors. NOTE: the `/api/v1/v3-score` prefix must be
 * registered as a Kong route pointing at the scoring service (port 8004).
 */

import api from '@/lib/api'
import type { GetV3ScoreParams, V3MonitoringResponse, V3ScoreListResponse } from './types'

const BASE_URL = '/api/v1/v3-score'

export async function getV3Scores(
  projectId: number,
  params: GetV3ScoreParams = {}
): Promise<V3ScoreListResponse> {
  const res = await api.get<V3ScoreListResponse>(`${BASE_URL}/${projectId}`, { params })
  return res.data
}

export async function getV3Monitoring(
  projectId: number,
  monthStart?: string
): Promise<V3MonitoringResponse> {
  const res = await api.get<V3MonitoringResponse>(`${BASE_URL}/${projectId}/monitoring`, {
    params: monthStart ? { month_start: monthStart } : {},
  })
  return res.data
}

export const scoringApi = { getV3Scores, getV3Monitoring }
