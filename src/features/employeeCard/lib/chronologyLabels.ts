import type { TFunction } from 'i18next'
import type { EmployeeEvent } from '../types'

/**
 * Turning one stored event into the line somebody reads.
 *
 * Every branch falls back to the event type rather than an empty string: a
 * kind of event this build has not been taught about should still take up a
 * line in the history, because a silent gap reads as nothing having happened.
 */

function text(value: unknown): string {
  return typeof value === 'string' && value.trim() ? value.trim() : ''
}

function score(payload: Record<string, unknown>): string {
  const points = payload.score
  const outOf = payload.max_score
  if (typeof points !== 'number') return ''
  return typeof outOf === 'number' ? `${points}/${outOf}` : String(points)
}

export function chronologyLabel(event: EmployeeEvent, t: TFunction): string {
  const key = `pages.employeeCard.chronology.events.${event.event_type}`
  const payload = event.payload ?? {}

  const values: Record<string, string> = {
    role: text(payload.role),
    department: text(payload.department),
    from: text(payload.from),
    to: text(payload.to),
    course: text(payload.course),
    kind: text(payload.kind) || text(payload.feedback_type),
    name: text(payload.name),
    score: score(payload),
  }

  const rendered = t(key, values)
  return rendered === key ? event.event_type : rendered
}

/**
 * Group by the year the thing happened in, newest first.
 *
 * The server already returns rows newest first, so the years come out in the
 * right order by walking the list once and keeping first-seen order rather
 * than sorting again on a different clock.
 */
export function groupByYear(events: EmployeeEvent[]): Array<{
  year: string
  events: EmployeeEvent[]
}> {
  const groups: Array<{ year: string; events: EmployeeEvent[] }> = []

  for (const event of events) {
    const year = String(new Date(event.occurred_at).getFullYear())
    const current = groups[groups.length - 1]
    if (current && current.year === year) {
      current.events.push(event)
      continue
    }
    groups.push({ year, events: [event] })
  }

  return groups
}
