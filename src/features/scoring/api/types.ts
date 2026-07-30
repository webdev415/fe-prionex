/**
 * Scoring v3 (priority) API types — mirrors the scoring service KAN-790 output.
 */

export type V3Bucket = 'EXIT' | 'LOW' | 'AVG' | 'HIGH' | 'CRIT'

export interface V3ScoreResult {
  debt_id: number
  project_id: number
  month_start: string
  bucket_v3: V3Bucket
  bucket_ml: string | null
  hazard: number | null
  score: number | null
  priority_dollar: number | null
  rule_fired: string | null
  model_id: string
  scored_at: string
}

export interface V3ScoreListResponse {
  project_id: number
  month_start: string | null
  total: number
  results: V3ScoreResult[]
}

export interface GetV3ScoreParams {
  month_start?: string
  bucket?: V3Bucket
  include_exit?: boolean
  debt_id?: number
  client_id?: number
  min_hazard?: number
  limit?: number
  offset?: number
}

export interface V3ClientRollup {
  client_id: number
  bucket_v3: V3Bucket
  priority_dollar: number
}

export interface V3ClientOrderResponse {
  project_id: number
  month_start: string | null
  total: number
  results: V3ClientRollup[]
}

export interface V3MonitoringResponse {
  project_id: number
  month_start: string | null
  total: number
  bucket_counts: Record<string, number>
  bucket_pct: Record<string, number>
  exit_rate: number
  avg_or_higher_share: number
  hazard_mean: number | null
  hazard_p50: number | null
  hazard_p90: number | null
  total_priority_dollar: number
  rule_fired_counts: Record<string, number>
}

/** Per-brand v3 UI cutover switch (KAN-791/794). */
export interface V3UiEnabled {
  project_id: number | null
  enabled: boolean
  /** 'database' once set for the brand; 'default'/'fallback' mean off. */
  source: string
}

/** One decile of the predicted-vs-actual calibration table (KAN-794 gate metric). */
export interface V3CalibrationBin {
  bin: number
  n: number
  predicted_mean: number
  actual_rate: number
}

export interface V3CalibrationResponse {
  project_id: number
  month_start: string
  n: number
  n_bins: number
  predicted_base_rate: number | null
  actual_base_rate: number | null
  calibration_error: number | null
  bins: V3CalibrationBin[]
}

export interface V3DriftDeltas {
  bucket_pct_delta: Record<string, number>
  exit_rate_delta: number
  avg_or_higher_share_delta: number
  hazard_mean_delta: number | null
  total_delta: number
}

export interface V3DriftResponse {
  project_id: number
  from_month: string
  to_month: string
  from_summary: V3MonitoringResponse
  to_summary: V3MonitoringResponse
  deltas: V3DriftDeltas
}
