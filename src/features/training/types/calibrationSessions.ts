/** Types for calibration sessions (1-on-1 Sessions calendar). Mirror quality-service. */

export type CalibrationStatus = 'scheduled' | 'completed' | 'cancelled'
export type CalibrationFormat = 'in_person' | 'zoom' | 'phone'

export interface CalibrationSessionCard {
  id: number
  project_id: number
  course_id?: number | null
  title: string
  topic?: string | null
  scheduled_at: string
  duration_minutes: number
  format: CalibrationFormat
  status: CalibrationStatus
  created_by_user_id: number
  created_at: string
  trainer_ids: number[]
  participant_ids: number[]
}

export interface CalibrationCalendarDay {
  date: string
  sessions: CalibrationSessionCard[]
}

export interface CalibrationCalendarResponse {
  days: CalibrationCalendarDay[]
  total: number
}

export interface CalibrationCalendarFilters {
  from?: string
  to?: string
}

export interface CreateCalibrationSessionPayload {
  scheduled_at: string
  course_id?: number | null
  title?: string | null
  topic?: string | null
  duration_minutes?: number
  format?: CalibrationFormat
  trainer_ids: number[]
  participant_ids: number[]
}
