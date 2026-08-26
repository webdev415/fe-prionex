import { describe, expect, it } from 'vitest'
import { chronologyLabel, groupByYear } from '../lib/chronologyLabels'
import type { EmployeeEvent } from '../types'

const PHRASES: Record<string, string> = {
  'pages.employeeCard.chronology.events.hired': 'Hired - {{department}}, {{role}}',
  'pages.employeeCard.chronology.events.role_changed': 'Role changed - {{from}} to {{to}}',
  'pages.employeeCard.chronology.events.evaluation_completed': 'Quality assessment - {{score}}',
}

function translate(key: string, values?: Record<string, string>) {
  const phrase = PHRASES[key]
  if (!phrase) return key
  return phrase.replace(/{{(\w+)}}/g, (_, name: string) => values?.[name] ?? '')
}

const t = translate as unknown as Parameters<typeof chronologyLabel>[1]

function event(overrides: Partial<EmployeeEvent> = {}): EmployeeEvent {
  return {
    id: 1,
    category: 'personnel',
    event_type: 'hired',
    occurred_at: '2024-03-15T00:00:00Z',
    project_id: 3,
    payload: { role: 'Operator', department: 'Collections' },
    ...overrides,
  }
}

describe('chronologyLabel', () => {
  it('reads a hire into the phrase for it', () => {
    expect(chronologyLabel(event(), t)).toBe('Hired - Collections, Operator')
  })

  it('says what a role moved between rather than naming the direction', () => {
    const label = chronologyLabel(
      event({
        event_type: 'role_changed',
        payload: { from: 'Operator', to: 'Senior Operator' },
      }),
      t
    )

    expect(label).toBe('Role changed - Operator to Senior Operator')
  })

  it('shows a score out of its maximum when both are there', () => {
    const label = chronologyLabel(
      event({
        event_type: 'evaluation_completed',
        payload: { score: 87, max_score: 100 },
      }),
      t
    )

    expect(label).toBe('Quality assessment - 87/100')
  })

  it('shows a bare score when no maximum came with it', () => {
    const label = chronologyLabel(
      event({ event_type: 'evaluation_completed', payload: { score: 87 } }),
      t
    )

    expect(label).toBe('Quality assessment - 87')
  })

  it('still takes up a line for a kind of event it has no phrase for', () => {
    expect(chronologyLabel(event({ event_type: 'something_new' }), t)).toBe('something_new')
  })

  it('leaves a missing value out rather than printing undefined', () => {
    const label = chronologyLabel(event({ payload: { role: 'Operator' } }), t)

    expect(label).toBe('Hired - , Operator')
    expect(label).not.toContain('undefined')
  })

  it('survives an event with no payload at all', () => {
    const label = chronologyLabel({ ...event(), payload: {} as Record<string, unknown> }, t)

    expect(label).not.toContain('undefined')
  })
})

describe('groupByYear', () => {
  it('keeps the order the server sent and starts a group per year', () => {
    const groups = groupByYear([
      event({ id: 1, occurred_at: '2026-01-05T00:00:00Z' }),
      event({ id: 2, occurred_at: '2025-11-02T00:00:00Z' }),
      event({ id: 3, occurred_at: '2025-03-01T00:00:00Z' }),
      event({ id: 4, occurred_at: '2024-03-15T00:00:00Z' }),
    ])

    expect(groups.map((group) => group.year)).toEqual(['2026', '2025', '2024'])
    expect(groups[1].events.map((one) => one.id)).toEqual([2, 3])
  })

  it('does not merge two runs of the same year that are not adjacent', () => {
    const groups = groupByYear([
      event({ id: 1, occurred_at: '2025-11-02T00:00:00Z' }),
      event({ id: 2, occurred_at: '2024-03-15T00:00:00Z' }),
      event({ id: 3, occurred_at: '2025-01-01T00:00:00Z' }),
    ])

    expect(groups.map((group) => group.year)).toEqual(['2025', '2024', '2025'])
  })

  it('has nothing to group when there is nothing', () => {
    expect(groupByYear([])).toEqual([])
  })
})
