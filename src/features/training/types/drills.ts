/** Types for the Drill Exercises surface (KAN-751). Mirror the quality-service schemas. */

export type DrillStatus = 'active' | 'archived'
export type AttemptState = 'assigned' | 'submitted' | 'scored'

export interface DrillCardData {
  id: number
  project_id: number
  title: string
  description?: string | null
  difficulty?: string | null
  duration_minutes?: number | null
  status: DrillStatus
  created_by_user_id: number
  created_at: string
  updated_at: string
  attempt_count: number
}

export interface DrillListResponse {
  data: DrillCardData[]
  total: number
}

export interface DrillListFilters {
  status?: DrillStatus
  q?: string
  limit?: number
  offset?: number
}

export interface DrillCreatePayload {
  title: string
  description?: string | null
  difficulty?: string | null
  duration_minutes?: number | null
  status?: DrillStatus
}

export interface DrillUpdatePayload {
  title?: string
  description?: string | null
  difficulty?: string | null
  duration_minutes?: number | null
  status?: DrillStatus
}

export interface DrillAttemptCard {
  id: number
  drill_id: number
  operator_id: number
  assigned_by_user_id?: number | null
  submitted_at?: string | null
  score?: number | null
  reviewed_by_user_id?: number | null
  reviewed_at?: string | null
  state: AttemptState
}

export interface AssignDrillResponse {
  attempts: DrillAttemptCard[]
}
