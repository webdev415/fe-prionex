/** KAN-411 Feature 3.1 — correction-task types.
 *
 * Mirrors the Pydantic schemas in
 * `api-prionex/services/task/app/schemas/correction.py`. The seven-state
 * lifecycle from the spec is enforced by the BE; the FE narrows around
 * the same union so disallowed transitions are caught at compile time.
 */

export type CorrectionTaskType =
  | 'correction'
  | 'listen_reflect'
  | 'practice_next_call'
  | 'study_material'

export type CorrectionTaskStatus =
  | 'created'
  | 'notified'
  | 'read'
  | 'in_progress'
  | 'completed'
  | 'confirmed'
  | 'returned_for_revision'

export type CorrectionTaskPriority = 'low' | 'normal' | 'high' | 'urgent' | 'critical'

export interface CorrectionTask {
  id: number
  project_id: number
  operator_id: number | null
  call_id: string | null
  call_timestamp_seconds: number | null
  task_type: CorrectionTaskType | null
  title: string
  description: string | null
  priority: CorrectionTaskPriority
  status: CorrectionTaskStatus
  due_date: string | null
  is_overdue: boolean
  created_by: number
  created_at: string
  updated_at: string | null
}

export interface CorrectionTaskCreatePayload {
  operator_id: number
  call_id: string
  call_timestamp_seconds?: number | null
  task_type?: CorrectionTaskType
  title: string
  description?: string | null
  due_date?: string | null
  priority?: CorrectionTaskPriority
  project_id?: number
}

export interface CorrectionTransitionPayload {
  to_state: CorrectionTaskStatus
  comment?: string | null
}

export interface CorrectionTaskListFilters {
  operator_ids?: number[]
  statuses?: CorrectionTaskStatus[]
  task_types?: CorrectionTaskType[]
  overdue_only?: boolean
  limit?: number
  offset?: number
}

export interface CorrectionStats {
  operator_id: number
  period_from: string | null
  period_to: string | null
  created_count: number
  completed_count: number
  overdue_count: number
  average_complete_minutes: number | null
  return_rate_pct: number | null
  completion_on_time_pct: number | null
}
