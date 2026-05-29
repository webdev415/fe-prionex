// Coaching / Inbox types (KAN-413). Mirror the Pydantic schemas in
// api-prionex/services/quality/app/schemas/coaching.py.

import type { Pagination } from '../types'

export type AssignmentState = 'wait' | 'in_progress' | 'awaiting_training' | 'scheduled' | 'closed'

export type OneOnOneStatus = 'scheduled' | 'completed' | 'cancelled'

export type ScoreBand = 'red' | 'amber' | 'green'

export const ASSIGNMENT_STATES: readonly AssignmentState[] = [
  'wait',
  'in_progress',
  'awaiting_training',
  'scheduled',
  'closed',
]

export interface OperatorKpis {
  script_adherence_pct: number | null
  avg_scorecard_pct: number | null
  conversion_rate: number | null
  task_completion_on_time_pct: number | null
  red_flag_count: number
}

export interface AssignmentSummary {
  id: number
  state: AssignmentState
  notes: string | null
  updated_at: string
  trainer_id: number
}

export interface QueueOperator {
  operator_id: number
  composite_score: number
  score_band: ScoreBand
  assignment: AssignmentSummary | null
  kpis: OperatorKpis
  triggers: string[]
  /** ISO 8601 timestamp of the operator's most recent quality activity. */
  last_active_at: string | null
}

export interface QueueResponse {
  data: QueueOperator[]
  pagination: Pagination
}

export interface ScorecardSummary {
  id: number
  call_id: string
  weighted_score: number | null
  status: string
  created_at: string
}

export interface OperatorDetail extends QueueOperator {
  latest_scorecards: ScorecardSummary[]
  active_markers_count: number
  open_tasks_count: number
}

export interface HeaderKpis {
  in_progress_count: number
  average_score: number
  average_score_delta_pct: number | null
  team_plan_pct: number
  team_plan_delta_pct: number | null
  tasks_today_count: number
  one_on_one_today_count: number
  period_from: string
  period_to: string
}

export interface OneOnOneRecord {
  id: number
  trainer_id: number
  operator_id: number
  scheduled_at: string
  duration_minutes: number
  status: OneOnOneStatus
  notes: string | null
  created_at: string
}

export type CoachingPeriod = 'today' | 'yesterday' | 'last_7d' | 'last_30d' | 'custom'

export interface QueueFilters {
  user_ids?: number[]
  state?: AssignmentState[]
  period?: CoachingPeriod
  from_date?: string
  to_date?: string
  page?: number
  page_size?: number
}

export interface HeaderKpisFilters {
  user_ids?: number[]
  period?: CoachingPeriod
  from_date?: string
  to_date?: string
}

export interface OperatorDetailFilters {
  operator_id: number
  period?: CoachingPeriod
  from_date?: string
  to_date?: string
}

export interface ScheduleOneOnOnePayload {
  operator_id: number
  /** ISO 8601 string; backend rejects past times. */
  scheduled_at: string
  duration_minutes?: number
  notes?: string | null
}

export interface TransitionAssignmentPayload {
  to_state: AssignmentState
  notes?: string | null
}

export interface TakeChargePayload {
  operator_id: number
  notes?: string | null
}
