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
  /** Why an EXIT debt is excluded: deceased | fraud | lawsuit | paid_off | closed. */
  exit_reason?: string | null
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

/**
 * v3 scoring tunables (KAN-792) — every knob ops can change without a deploy.
 *
 * Mirrors `scoring-service app/schemas/v3_settings.V3ScoringSettings`, which is
 * the schema of record and the only place these are validated. Keep the field
 * names identical: the payload is passed straight through the gateway.
 */
export interface V3Settings {
  /** ML cutoff: hazard >= tau -> AVG, else LOW. */
  tau: number

  /** Promise-to-pay windows, in days. */
  ptp_active_window_days: number
  ptp_broken_min_days: number
  ptp_broken_max_days: number
  ptp_active_max_age_days: number

  /** Inbound-contact recency bands, in days. */
  inbound_crit_max_days: number
  inbound_high_max_days: number

  /** Partial-payment cadence bands, in days. */
  partial_avg_max_days: number
  partial_high_max_days: number
  /** null = a stale partial payment forces CRIT forever (package default). */
  partial_pay_expire_days: number | null

  /** Compliance de-prioritisation: more contacts than this in 7 days -> LOW. */
  weekly_contact_cap: number

  /** Floor rules: pin an engaged debt up from LOW to AVG. */
  floor_min_real_payments: number
  floor_min_reached_rate: number

  /** result_code -> ttl_days overrides. Absent codes keep the package TTL. */
  result_ttls: Record<string, number>
}

/** One queue-size choice: "N% of debts means tau X, i.e. this many to work".
 *  Computed from the brand's own hazard distribution; `debts` is null when the
 *  server falls back to the package's generic reference table. */
export interface TauCapacityPoint {
  avg_share: number
  tau: number
  debts?: number | null
  /** How much richer in payers this queue is than the book average (e.g. 2.61). */
  pay_lift?: number | null
  /** Share of all expected payers this queue reaches (0..1). */
  payers_captured?: number | null
}

export interface V3SettingsResponse {
  project_id: number | null
  is_global: boolean
  settings: V3Settings
  /** 'database' once a brand has saved its own values, else 'default'. */
  source: string
  /** Out-of-the-box values — served so the UI never hard-codes a stale default. */
  defaults?: V3Settings
  /** result_code -> {bucket, ttl_days} from the scoring package. */
  rule_table?: Record<string, { bucket: string; ttl_days: number }>
  tau_capacity_guide?: TauCapacityPoint[]
}

/** Clients per bucket, for the client-list summary cards (KAN-791). */
export interface V3ClientBucketCount {
  bucket: V3Bucket
  clients: number
  /** Sum of hazard x principal for that bucket's workable debts. */
  priority_dollar: number
}

export interface V3ClientSummaryResponse {
  project_id: number
  month_start: string | null
  buckets: V3ClientBucketCount[]
}
