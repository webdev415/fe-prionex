/** Types for the unified Assignments grid. Mirror quality-service. */

export type AssignmentKind = 'course' | 'drill'
export type AssignmentStatus = 'not_started' | 'in_progress' | 'completed'

export interface TrainingAssignmentRow {
  kind: AssignmentKind
  ref_id: number
  title: string
  operator_id: number
  status: AssignmentStatus
  progress_pct: number
  assigned_at: string
  due_at?: string | null
  overdue: boolean
}

export interface AssignmentKpis {
  total_active: number
  completed: number
  overdue: number
}

export interface AssignmentListResponse {
  rows: TrainingAssignmentRow[]
  kpis: AssignmentKpis
  total: number
}

export interface AssignmentFilters {
  operator_id?: number
}
