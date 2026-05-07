export type AnalyticsPeriod = 'today' | 'yesterday' | 'last_7d' | 'last_30d' | 'custom'

export type AnalyticsEventType =
  | 'route_change'
  | 'client_card_open'
  | 'client_card_tab_switch'
  | 'interaction_form_open'
  | 'interaction_form_submit'
  | 'call_player_action'
  | 'idle_detected'

export interface TrackingEventPayload {
  ts: string
  session_id: string
  call_id?: string | null
  client_id?: number | null
  event_type: AnalyticsEventType
  page_ref?: string | null
  meta?: Record<string, unknown> | null
}

export interface IngestEventsRequest {
  events: TrackingEventPayload[]
}

export interface IngestEventsResponse {
  accepted: number
  queued_at: string
}

export interface TimelineQuery {
  call_id: string
}

export interface TimelineEventDto {
  ts: string
  event_type: string
  page_ref?: string | null
  meta?: Record<string, unknown> | null
  offset_seconds?: number | null
}

export interface TimelineResponse {
  call_id: string
  call_started_at?: string | null
  call_ended_at?: string | null
  events: TimelineEventDto[]
  total: number
}

export interface AnalyticsRangeFilters {
  operator_ids?: number[]
  period?: AnalyticsPeriod
  from_date?: string
  to_date?: string
}

export interface ScreenTimeOperatorDto {
  operator_id: number
  time_to_card_open_ms: number
  time_per_tab_ms: Record<string, number>
  time_to_form_submit_ms: number
  idle_total_ms: number
  after_call_processing_ms: number
  team_avg_time_to_card_open_ms?: number | null
  deviation_pct?: number | null
  highlight?: 'red' | 'green' | null
  sample_size: number
}

export interface ScreenTimeResponse {
  period_from: string
  period_to: string
  operators: ScreenTimeOperatorDto[]
  benchmark_metric: string
}

export type HeatmapState = 'active_call' | 'post_call' | 'waiting' | 'idle' | 'break'

export interface HeatmapMinuteBreakdownDto {
  active_call: number
  post_call: number
  waiting: number
  idle: number
  break: number
}

export interface HeatmapHourBucketDto {
  hour: string
  dominant_state: HeatmapState
  minute_breakdown: HeatmapMinuteBreakdownDto
}

export interface HeatmapOperatorDto {
  operator_id: number
  hours: HeatmapHourBucketDto[]
}

export interface HeatmapResponse {
  period_from: string
  period_to: string
  operators: HeatmapOperatorDto[]
}

export interface HeatmapFilters extends AnalyticsRangeFilters {
  state_filter?: HeatmapState
}

export interface ScriptAnalyticsOperatorDto {
  operator_id: number
  distribution: Record<string, number>
  contact_type_split: Record<string, number>
  no_result_pct: number
  fast_result_pct: number
  total_interactions: number
}

export interface ScriptAnalyticsFlagDto {
  operator_id: number
  rule: string
  value: number
  threshold: number
  triggered_at: string
  detail?: string | null
}

export interface ScriptAnalyticsResponse {
  period_from: string
  period_to: string
  operators: ScriptAnalyticsOperatorDto[]
  team_distribution: Record<string, number>
  flags: ScriptAnalyticsFlagDto[]
}
