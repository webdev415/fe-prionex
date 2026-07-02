/** Types for the Drill Exercises surface (KAN-751 / KAN-761). Mirror the quality-service schemas. */

export type DrillStatus = 'active' | 'archived'
export type DrillCategory = 'objection_handling' | 'opening' | 'closing' | 'tone' | 'compliance'
export type SkillLevel = 'beginner' | 'intermediate' | 'advanced'
export type AttemptStatus =
  | 'assigned'
  | 'in_progress'
  | 'completed'
  | 'confirmed'
  | 'returned_for_revision'

export interface DrillCardData {
  id: number
  project_id: number
  title: string
  description?: string | null
  category?: DrillCategory | null
  skill_level?: SkillLevel | null
  duration_minutes?: number | null
  success_criteria?: string | null
  reference_call_id?: string | null
  reference_material_id?: number | null
  status: DrillStatus
  created_by_user_id: number
  created_at: string
  updated_at: string
  attempt_count: number
  completion_pct?: number | null
}

export interface DrillListResponse {
  data: DrillCardData[]
  total: number
}

export interface DrillListFilters {
  status?: DrillStatus
  category?: DrillCategory
  skill_level?: SkillLevel
  q?: string
  limit?: number
  offset?: number
}

export interface DrillCreatePayload {
  title: string
  description?: string | null
  category?: DrillCategory | null
  skill_level?: SkillLevel | null
  duration_minutes?: number | null
  success_criteria?: string | null
  reference_call_id?: string | null
  reference_material_id?: number | null
  status?: DrillStatus
}

export type DrillUpdatePayload = Partial<DrillCreatePayload>

export interface DrillAttemptCard {
  id: number
  drill_id: number
  operator_id: number
  assigned_by_user_id?: number | null
  status: AttemptStatus
  deadline?: string | null
  assignment_note?: string | null
  reflection?: string | null
  review_comment?: string | null
  completed_at?: string | null
  reviewed_by_user_id?: number | null
  reviewed_at?: string | null
  created_at: string
  updated_at: string
  is_overdue: boolean
}

export interface AssignDrillPayload {
  operator_ids: number[]
  deadline?: string | null
  note?: string | null
}

export interface AssignDrillResponse {
  attempts: DrillAttemptCard[]
}

export interface AttemptTransitionPayload {
  to_status: AttemptStatus
  reflection?: string | null
  comment?: string | null
}

export interface DrillStats {
  drill_id: number
  total: number
  assigned: number
  in_progress: number
  completed: number
  confirmed: number
  returned_for_revision: number
  overdue: number
  completion_pct: number
  avg_complete_minutes?: number | null
}

export interface OperatorDrillStats {
  operator_id: number
  assigned: number
  completed: number
  overdue: number
  confirmation_pct?: number | null
}

export interface TrainerDrillStats {
  trainer_id: number
  drills_authored: number
  total_assignments: number
  completion_pct?: number | null
}
