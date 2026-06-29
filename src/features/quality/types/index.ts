// Quality service types (KAN-410). Mirror the Pydantic schemas in
// api-prionex/services/quality/app/schemas/.

export type CriterionScale = 'binary' | '0-5'

export interface Criterion {
  key: string
  name: string
  scale: CriterionScale
  weight: number
}

export interface Section {
  key: string
  name: string
  criteria: Criterion[]
}

export type ScorecardType = 'client' | 'third_party'

export interface ScorecardTemplate {
  id: number
  project_id: number
  name: string
  description: string | null
  call_type: 'inbound' | 'outbound' | null
  department_id: number | null
  // KAN-504: 'client' | 'third_party' for the two typed templates; null for
  // the legacy "Default Scorecard".
  scorecard_type: ScorecardType | null
  sections: Section[]
  is_archived: boolean
  created_by: number
  created_at: string
  updated_at: string
}

// Filled-in value for a single criterion. `value` is integer 0..5 for the
// '0-5' scale and boolean for 'binary'. The backend cross-checks the type
// against the template snapshot.
export interface ScoreEntry {
  value: number | boolean | null
  comment?: string | null
}

export type ScoresPayload = Record<string, ScoreEntry>

export type ScorecardStatus = 'draft' | 'completed' | 'sent'

export interface Scorecard {
  id: number
  call_id: string
  operator_id: number
  trainer_id: number
  project_id: number
  template_id: number
  template_snapshot: {
    id: number
    name: string
    description: string | null
    call_type: string | null
    department_id: number | null
    // KAN-504: frozen scorecard type (optional — legacy snapshots predate it).
    scorecard_type?: ScorecardType | null
    sections: Section[]
  }
  scores: ScoresPayload
  overall_comment: string | null
  weighted_score: number | null
  status: ScorecardStatus
  created_at: string
  completed_at: string | null
  sent_at: string | null
}

export interface ScorecardHistoryItem {
  id: number
  trainer_id: number
  weighted_score: number | null
  status: ScorecardStatus
  created_at: string
  completed_at: string | null
  sent_at: string | null
}

export interface ScorecardListFilters {
  operator_id?: number[]
  trainer_id?: number[]
  status?: ScorecardStatus[]
  period?: string
  from_date?: string
  to_date?: string
  page?: number
  page_size?: number
}

export interface ScorecardCreatePayload {
  call_id: string
  operator_id: number
  template_id: number
  scores?: ScoresPayload
  overall_comment?: string | null
  status?: 'draft' | 'completed'
}

export interface ScorecardUpdatePayload {
  scores?: ScoresPayload
  overall_comment?: string | null
  status?: ScorecardStatus
}

// ---- Score aggregation by period (KAN-504) ----

export type AggregateGroupBy = 'operator' | 'team' | 'all'

export interface AggregateRow {
  // operator_id (group_by=operator), team/group id (group_by=team), or null
  // (group_by=all).
  entity_id: number | null
  entity_name: string
  avg_client: number | null
  avg_third_party: number | null
  calls_scored: number
  trend_vs_prior: number | null
}

export interface AggregateResponse {
  group_by: AggregateGroupBy
  period_from: string
  period_to: string
  rows: AggregateRow[]
}

export interface AggregateFilters {
  period?: string
  from_date?: string
  to_date?: string
  group_by?: AggregateGroupBy
  operator_id?: number[]
}

// ---- Script Stage Funnel (KAN-503) ----

export type FunnelBand = 'green' | 'yellow' | 'red'

export interface StageDto {
  key: string
  label_en: string
  label_uk: string
  order: number
  expected: number
  actual: number
  drop_pct: number
  band: FunnelBand
}

export interface PainPointDto {
  stage: string
  label_en: string
  label_uk: string
  drop_pct: number
  band: FunnelBand
  // Critical only — operators whose personal drop exceeds the red threshold.
  operators_below: number | null
  recommendation: string
}

export interface PainPoints {
  critical: PainPointDto[]
  warning: PainPointDto[]
  stable: PainPointDto[]
}

export interface StageFunnelResponse {
  period_from: string
  period_to: string
  // Denominator — scored calls counted into the funnel (surfaced in the UI).
  evaluated_calls: number
  stages: StageDto[]
  pain_points: PainPoints
}

export interface StageFunnelFilters {
  period?: string
  from_date?: string
  to_date?: string
  operator_ids?: number[]
  department_ids?: number[]
}

export interface Pagination {
  page: number
  page_size: number
  total: number
  total_pages: number
}

export interface PageResponse<T> {
  data: T[]
  pagination: Pagination
}

// ---- Markers (KAN-410, Feature 2.2) ----

export type MarkerType =
  | 'error'
  | 'good_moment'
  | 'script_violation'
  | 'stop_word'
  | 'unmotivated_pause'
  | 'note'

export type MarkerStatus = 'draft' | 'sent'

export const MARKER_TYPES: MarkerType[] = [
  'error',
  'good_moment',
  'script_violation',
  'stop_word',
  'unmotivated_pause',
  'note',
]

// Default color palette for marker dots. KAN-412 will let admins reshape
// this; v1 ships a fixed scheme so the timeline is readable from day one.
export const MARKER_COLORS: Record<MarkerType, string> = {
  error: '#ef4444',
  good_moment: '#22c55e',
  script_violation: '#f97316',
  stop_word: '#a855f7',
  unmotivated_pause: '#eab308',
  note: '#0ea5e9',
}

export interface CallMarker {
  id: number
  call_id: string
  operator_id: number
  trainer_id: number
  project_id: number
  timestamp_ms: number
  marker_type: MarkerType
  comment: string | null
  status: MarkerStatus
  added_to_library: boolean
  created_at: string
  updated_at: string
}

export interface MarkerCreatePayload {
  timestamp_ms: number
  marker_type: MarkerType
  comment?: string | null
  operator_id: number
}

export interface MarkerUpdatePayload {
  timestamp_ms?: number
  marker_type?: MarkerType
  comment?: string | null
  status?: MarkerStatus
}

export interface MarkerListFilters {
  operator_id?: number[]
  trainer_id?: number[]
  marker_type?: MarkerType[]
  status?: MarkerStatus[]
  period?: string
  from_date?: string
  to_date?: string
  page?: number
  page_size?: number
}

// ---- Feedback (KAN-410, Feature 2.3) ----

export type FeedbackType = 'praise' | 'note' | 'correction_task'
export type FeedbackStatus = 'unread' | 'read' | 'completed'

export const FEEDBACK_TYPES: FeedbackType[] = ['praise', 'note', 'correction_task']

export interface FeedbackReply {
  id: number
  feedback_id: number
  author_id: number
  author_role: 'trainer' | 'operator'
  text: string
  created_at: string
}

export interface Feedback {
  id: number
  call_id: string
  operator_id: number
  trainer_id: number
  project_id: number
  feedback_type: FeedbackType
  text: string
  timestamp_ms: number | null
  status: FeedbackStatus
  created_at: string
  read_at: string | null
  completed_at: string | null
  replies: FeedbackReply[]
}

export interface FeedbackCreatePayload {
  call_id: string
  operator_id: number
  feedback_type: FeedbackType
  text: string
  timestamp_ms?: number | null
}

export interface FeedbackListFilters {
  operator_id?: number[]
  trainer_id?: number[]
  feedback_type?: FeedbackType[]
  status?: FeedbackStatus[]
  call_id?: string
  period?: string
  from_date?: string
  to_date?: string
  page?: number
  page_size?: number
}

// ---- Score Dynamics (KAN-410, Feature 2.4) ----

export type DynamicsGranularity = 'day' | 'week' | 'month'

export interface DynamicsPoint {
  bucket_start: string
  avg_score: number | null
  scorecard_count: number
  scorecard_ids: number[]
}

export interface SectionBreakdownPoint {
  bucket_start: string
  section_key: string
  avg_score: number | null
  scorecard_count: number
}

export interface TeamBenchmarkPoint {
  bucket_start: string
  team_avg_score: number | null
  operator_count: number
}

export interface DynamicsResponse {
  operator_id: number
  period_from: string
  period_to: string
  granularity: DynamicsGranularity
  points: DynamicsPoint[]
  by_section: SectionBreakdownPoint[]
  team_benchmark: TeamBenchmarkPoint[]
  period_avg: number | null
  period_min: number | null
  period_max: number | null
  scorecard_count: number
}

export interface DynamicsFilters {
  operator_id: number
  granularity?: DynamicsGranularity
  period?: string
  from_date?: string
  to_date?: string
}

export type DynamicsAlertType = 'score_drop' | 'consistent_growth'

export interface ScoreDynamicsAlert {
  id: number
  operator_id: number
  project_id: number
  alert_type: DynamicsAlertType
  prior_period_avg: number
  current_period_avg: number
  delta_pct: number
  triggered_at: string
  notified_trainer_ids: number[]
}

export interface AlertsResponse {
  alerts: ScoreDynamicsAlert[]
  total: number
}
