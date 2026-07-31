/**
 * Scoring v3 (priority) API client.
 *
 * Calls the scoring service through Kong (`/api/v1/v3-score/*`). The active
 * project id is part of the path; auth + active-project come from the shared
 * `api` instance interceptors. NOTE: the `/api/v1/v3-score` prefix must be
 * registered as a Kong route pointing at the scoring service (port 8004).
 */

import api from '@/lib/api'
import type {
  GetV3ScoreParams,
  V3CalibrationResponse,
  V3ClientOrderResponse,
  V3ClientRollup,
  V3DriftResponse,
  V3MonitoringResponse,
  V3ScoreListResponse,
  V3Settings,
  V3SettingsResponse,
  V3UiEnabled,
} from './types'

const BASE_URL = '/api/v1/v3-score'

/** Per-client v3 bucket rollup for a page of clients (client card/list). */
export async function getV3ClientRollup(
  projectId: number,
  clientIds: number[],
  monthStart?: string
): Promise<V3ClientRollup[]> {
  const res = await api.get<V3ClientRollup[]>(`${BASE_URL}/${projectId}/client-rollup`, {
    params: { client_ids: clientIds, ...(monthStart ? { month_start: monthStart } : {}) },
    paramsSerializer: { indexes: null }, // client_ids=1&client_ids=2 (repeated, no brackets)
  })
  return res.data
}

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

/** Snapshot months this brand actually has results for, newest first.
 *  Drives the month picker so it never offers a month that was never scored. */
export async function getV3ScoredMonths(projectId: number): Promise<string[]> {
  const res = await api.get<string[]>(`${BASE_URL}/${projectId}/months`)
  return res.data
}

/** Predicted-vs-actual pay rate by decile — the KAN-794 sign-off gate metric.
 *  Only meaningful once the scored month has elapsed and real payments exist. */
export async function getV3Calibration(
  projectId: number,
  monthStart: string,
  nBins = 10
): Promise<V3CalibrationResponse> {
  const res = await api.get<V3CalibrationResponse>(`${BASE_URL}/${projectId}/calibration`, {
    params: { month_start: monthStart, n_bins: nBins },
  })
  return res.data
}

/** Month-over-month distribution drift for a brand. */
export async function getV3Drift(
  projectId: number,
  fromMonth: string,
  toMonth: string
): Promise<V3DriftResponse> {
  const res = await api.get<V3DriftResponse>(`${BASE_URL}/${projectId}/drift`, {
    params: { from_month: fromMonth, to_month: toMonth },
  })
  return res.data
}

/** Trigger a re-score for a brand (async Celery job). */
export async function triggerV3Scoring(
  projectId: number,
  asOf?: string
): Promise<{ message: string; task_id: string; project_id: number }> {
  const res = await api.post(`${BASE_URL}/${projectId}/run`, null, {
    params: asOf ? { as_of: asOf } : {},
  })
  return res.data
}

/** A page of clients ranked by v3 priority (bucket → priority_dollar). */
export async function getV3ClientOrder(
  projectId: number,
  monthStart: string,
  limit: number,
  offset: number
): Promise<V3ClientOrderResponse> {
  const res = await api.get<V3ClientOrderResponse>(`${BASE_URL}/${projectId}/client-order`, {
    params: { month_start: monthStart, limit, offset },
  })
  return res.data
}

// The v3 UI cutover switch (KAN-791/794) is per brand and lives with the rest of
// the scoring config, so it goes through the client service's config proxy — not
// the /v3-score prefix above.
const CONFIG_BASE_URL = '/api/v1/config/scoring/v3/ui-enabled'
const SETTINGS_URL = '/api/v1/config/scoring/v3'

/** Is the v3 operator UI signed off and live for this brand? */
export async function getV3UiEnabled(projectId: number): Promise<V3UiEnabled> {
  const res = await api.get<V3UiEnabled>(CONFIG_BASE_URL, {
    params: { project_id: projectId },
  })
  return res.data
}

/** Flip a brand's cutover switch. Requires edit_scoring_config; audited. */
export async function setV3UiEnabled(
  projectId: number,
  enabled: boolean,
  changeReason?: string
): Promise<V3UiEnabled> {
  const res = await api.put<V3UiEnabled>(CONFIG_BASE_URL, {
    enabled,
    project_id: projectId,
    change_reason: changeReason,
  })
  return res.data
}

/** A brand's v3 tunables, plus the defaults and rule table they sit on (KAN-792). */
export async function getV3Settings(projectId: number): Promise<V3SettingsResponse> {
  const res = await api.get<V3SettingsResponse>(SETTINGS_URL, {
    params: { project_id: projectId },
  })
  return res.data
}

/** Save a brand's v3 tunables. Requires edit_scoring_config; validated + audited
 *  server-side, and applied on the NEXT scoring run (nothing is re-scored now). */
export async function updateV3Settings(
  projectId: number,
  settings: V3Settings,
  changeReason?: string
): Promise<V3SettingsResponse> {
  const res = await api.put<V3SettingsResponse>(SETTINGS_URL, {
    settings,
    project_id: projectId,
    change_reason: changeReason,
  })
  return res.data
}

export const scoringApi = {
  getV3Settings,
  updateV3Settings,
  getV3Scores,
  getV3Monitoring,
  triggerV3Scoring,
  getV3ClientRollup,
  getV3ClientOrder,
  getV3UiEnabled,
  setV3UiEnabled,
  getV3Calibration,
  getV3Drift,
  getV3ScoredMonths,
}
