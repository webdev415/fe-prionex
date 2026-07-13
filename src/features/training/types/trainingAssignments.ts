/** Types for the Training Assignments grid (KAN-498). Mirror quality-service. */

export type AssignmentStatus = 'done' | 'in_progress' | 'overdue'

export interface AssignmentRow {
  enrollment_id: number
  operator_id: number
  course_id: number
  course_title: string
  duration_minutes?: number | null
  lesson_count: number
  category?: string | null
  progress_pct: number
  deadline?: string | null
  status: AssignmentStatus
  assigned_at: string
}

export interface AssignmentKpis {
  total_active: number
  completed: number
  overdue: number
}

export interface AssignmentListResponse {
  rows: AssignmentRow[]
  kpis: AssignmentKpis
  total: number
}

export interface AssignmentFilters {
  operator_id?: number
  status?: AssignmentStatus
  q?: string
  limit?: number
  offset?: number
}
