/** Types for the Group Training Sessions surface (KAN-752). Mirror quality-service. */

export type GroupTrainingStatus = 'scheduled' | 'cancelled' | 'completed'

export interface GroupTrainingCardData {
  id: number
  project_id: number
  title: string
  type?: string | null
  location?: string | null
  description?: string | null
  trainer_id: number
  scheduled_at: string
  duration_minutes: number
  max_participants?: number | null
  meeting_url?: string | null
  status: GroupTrainingStatus
  created_at: string
  registered_count: number
  is_registered: boolean
}

export interface GroupTrainingListResponse {
  data: GroupTrainingCardData[]
  total: number
}

export interface GroupTrainingListFilters {
  status?: GroupTrainingStatus
  limit?: number
  offset?: number
}

export interface GroupTrainingCreatePayload {
  title: string
  type?: string | null
  location?: string | null
  description?: string | null
  scheduled_at: string
  duration_minutes?: number
  max_participants?: number | null
  meeting_url?: string | null
}

export interface GroupTrainingUpdatePayload {
  title?: string
  type?: string | null
  location?: string | null
  description?: string | null
  scheduled_at?: string
  duration_minutes?: number
  max_participants?: number | null
  meeting_url?: string | null
}

export interface GroupTrainingParticipant {
  operator_id: number
  registered_at: string
}

export interface GroupTrainingParticipantsResponse {
  group_training_id: number
  registered_count: number
  participants: GroupTrainingParticipant[]
}

export interface AssignParticipantsResponse {
  group_training_id: number
  registered_count: number
  assigned: number
  skipped_full: number
}

export interface RegistrationResponse {
  group_training_id: number
  operator_id: number
  is_registered: boolean
  registered_count: number
}
