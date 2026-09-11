import { describe, expect, it } from 'vitest'
import { chronologyLabel } from '@/features/employeeCard/lib/chronologyLabels'
import type { EmployeeEvent } from '@/features/employeeCard/types'

const table: Record<string, string> = {
  'pages.employeeCard.chronology.events.survey_completed': 'Survey — {{name}} ({{score}})',
  'pages.employeeCard.chronology.events.survey_completed_noScore':
    'Survey — {{name}} ({{pending}})',
  'pages.employeeCard.surveys.pending': 'Pending',
}

const t = ((key: string, opts?: Record<string, unknown>) => {
  const context = (opts as Record<string, string>)?.context
  const tpl = table[context ? `${key}_${context}` : key] ?? table[key]
  if (!tpl) return key
  return tpl.replace(/\{\{(\w+)\}\}/g, (_m, n) =>
    String((opts as Record<string, string>)?.[n] ?? '')
  )
}) as never

const ev = (payload: Record<string, unknown>): EmployeeEvent => ({
  id: 1,
  category: 'personnel',
  event_type: 'survey_completed',
  occurred_at: '2026-09-03T10:00:00Z',
  project_id: 3,
  payload,
})

describe('a survey on the chronology', () => {
  it('shows the score when there is one', () => {
    expect(chronologyLabel(ev({ name: 'Test1', score: 17, max_score: 20 }), t)).toBe(
      'Survey — Test1 (17/20)'
    )
  })

  it('reads as pending when it has not been marked, as the Surveys section does', () => {
    expect(chronologyLabel(ev({ name: 'Test1' }), t)).toBe('Survey — Test1 (Pending)')
  })
})
