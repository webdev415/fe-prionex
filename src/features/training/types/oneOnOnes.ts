/** Types for the 1-on-1 Sessions calendar projection. Mirror quality-service. */

export type OneOnOneStatus = 'scheduled' | 'completed' | 'cancelled'

export interface OneOnOneRecord {
  id: number
  trainer_id: number
  operator_id: number
  scheduled_at: string
  duration_minutes: number
  status: OneOnOneStatus
  notes?: string | null
  created_at: string
}

export interface OneOnOneCalendarDay {
  date: string
  sessions: OneOnOneRecord[]
}

export interface OneOnOneCalendarResponse {
  days: OneOnOneCalendarDay[]
  total: number
}

export interface OneOnOneCalendarFilters {
  from?: string
  to?: string
  scope?: 'mine' | 'with_me' | 'all'
}
