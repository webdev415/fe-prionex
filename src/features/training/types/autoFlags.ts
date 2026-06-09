/** KAN-411 Feature 3.3 — auto-flag types.
 *
 * Mirrors:
 *   - `api-prionex/services/quality/app/schemas/flag_events.py` (trainer review queue)
 *   - `api-prionex/services/analytics/app/schemas/auto_flag.py` (rules catalogue)
 *
 * The review-queue surface lives in quality-service; the rules CRUD
 * lives in analytics-service. The FE talks to both via the gateway.
 */

export type FlagEventStatus = 'pending' | 'confirmed' | 'dismissed'

export const FLAG_EVENT_STATUSES: readonly FlagEventStatus[] = [
  'pending',
  'confirmed',
  'dismissed',
]

export interface FlagEventCard {
  id: number
  project_id: number
  analytics_flag_id: number | null
  rule_code: string
  operator_id: number
  call_id: string | null
  client_id: number | null
  detected_at: string
  status: FlagEventStatus
  context: Record<string, unknown>
  reviewed_by_user_id: number | null
  reviewed_at: string | null
  dismiss_reason: string | null
}

export interface FlagEventListResponse {
  data: FlagEventCard[]
  total: number
}

export interface FlagEventListFilters {
  status?: FlagEventStatus
  rule_code?: string
  operator_id?: number[]
  from_date?: string
  to_date?: string
  limit?: number
  offset?: number
}

export interface FlagEventDismissPayload {
  reason?: string
}

export interface FlagEventBulkDismissPayload {
  rule_code: string
  period_from?: string
  period_to?: string
}

export interface FlagEventBulkDismissResponse {
  rule_code: string
  dismissed_count: number
}

export interface FlagEventConvertToTaskPayload {
  title?: string
  description?: string
  due_date?: string
}

export interface AutoFlagRule {
  id: number
  project_id: number | null
  code: string
  name: string
  description: string | null
  thresholds: Record<string, unknown>
  is_enabled: boolean
  is_local_evaluable: boolean
  created_at: string
}

export interface AutoFlagRuleUpdatePayload {
  is_enabled?: boolean
  thresholds?: Record<string, unknown>
}
