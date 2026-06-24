/** KAN-411 Feature 3.2 — leaderboard + badges types.
 *
 * Mirrors `api-prionex/services/quality/app/schemas/leaderboard.py`.
 * The snapshot is computed on first GET per (project, period, UTC day)
 * and served from cache thereafter; `?refresh=true` forces recompute.
 */

export type LeaderboardPeriod = 'week' | 'month'

export const LEADERBOARD_PERIODS: readonly LeaderboardPeriod[] = ['week', 'month']

export interface LeaderboardScoreComponents {
  script_adherence_pct: number | null
  avg_scorecard_pct: number | null
  task_completion_on_time_pct: number | null
  conversion_rate: number | null
  red_flag_penalty: number | null
}

export interface LeaderboardRow {
  operator_id: number
  rank: number
  score: number
  components: LeaderboardScoreComponents
  /**
   * Signed difference vs prior period. Positive = improved (rank
   * dropped from 7 → 4 = +3). Null when no prior snapshot exists or
   * the operator wasn't ranked last period.
   */
  rank_change_vs_prior: number | null
}

export interface LeaderboardResponse {
  project_id: number
  period: LeaderboardPeriod
  period_start: string
  period_end: string
  computed_at: string
  ranking: LeaderboardRow[]
}

export interface BadgeDefinition {
  id: number
  project_id: number | null
  code: string
  name: string
  description: string | null
  icon: string | null
  awarded_automatically: boolean
  award_rule: Record<string, unknown>
  is_active: boolean
}

export interface OperatorBadge {
  id: number
  project_id: number
  operator_id: number
  badge_id: number
  awarded_at: string
  awarded_by_user_id: number | null
  metadata_json: Record<string, unknown>
  code: string
  name: string
  description: string | null
  icon: string | null
}

export interface ManualBadgeAwardPayload {
  operator_id: number
  badge_code: string
  metadata?: Record<string, unknown>
}
