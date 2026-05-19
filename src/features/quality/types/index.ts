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

export interface ScorecardTemplate {
  id: number
  project_id: number
  name: string
  description: string | null
  call_type: 'inbound' | 'outbound' | null
  department_id: number | null
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
