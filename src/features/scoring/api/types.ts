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
  limit?: number
  offset?: number
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
