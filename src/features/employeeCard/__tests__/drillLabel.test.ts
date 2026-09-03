import { describe, expect, it } from 'vitest'
import { chronologyLabel } from '@/features/employeeCard/lib/chronologyLabels'
import type { EmployeeEvent } from '@/features/employeeCard/types'

const t = ((key: string, opts?: Record<string, unknown>) => {
  const table: Record<string, string> = {
    'pages.employeeCard.chronology.events.drill_assigned': 'Drill assigned — {{drill}}',
    'pages.employeeCard.chronology.events.drill_completed': 'Completed drill — {{drill}}',
  }
  const tpl = table[key]
  if (!tpl) return key
  return tpl.replace(/\{\{(\w+)\}\}/g, (_m, n) =>
    String((opts as Record<string, string>)?.[n] ?? '')
  )
}) as never

const ev = (event_type: string): EmployeeEvent => ({
  id: 1,
  category: 'training',
  event_type,
  occurred_at: '2026-09-03T10:00:00Z',
  project_id: 3,
  payload: { drill: 'Objection handling drill' },
})

describe('a drill on the chronology', () => {
  it('names the drill, not a course', () => {
    expect(chronologyLabel(ev('drill_assigned'), t)).toBe(
      'Drill assigned — Objection handling drill'
    )
    expect(chronologyLabel(ev('drill_completed'), t)).toBe(
      'Completed drill — Objection handling drill'
    )
  })
})
