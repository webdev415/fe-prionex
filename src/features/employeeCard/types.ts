/**
 * The employee card's chronology.
 *
 * Rows come from several services - evaluations, feedback and training from
 * quality, hires and role changes from auth - but the page reads one list,
 * because a timeline stitched together per request cannot be paged correctly.
 */

export const EVENT_CATEGORIES = [
  'personnel',
  'evaluation',
  'feedback',
  'training',
  'survey',
] as const

export type EventCategory = (typeof EVENT_CATEGORIES)[number]

export interface EmployeeEvent {
  id: number
  category: EventCategory
  event_type: string
  occurred_at: string
  project_id: number | null
  payload: Record<string, unknown>
}

export interface EmployeeEventPage {
  events: EmployeeEvent[]
  next_cursor: string | null
  has_more: boolean
}

export interface EmployeeEventQuery {
  category?: EventCategory
  occurred_from?: string
  occurred_to?: string
  page_size?: number
}
