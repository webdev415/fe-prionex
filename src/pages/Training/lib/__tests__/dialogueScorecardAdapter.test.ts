/**
 * KAN-737 — adapter from the live `Scorecard` payload to the Dialogue
 * Evaluation row + criteria shapes. Covers the score-band category derivation,
 * the `null` weighted_score path, and the criteria builder for both the `'0-5'`
 * and `binary` criterion scales.
 */
import { describe, it, expect } from 'vitest'
import type { Scorecard } from '@/features/quality'
import type { OperatorUser } from '@/features/users/api/usersApi'
import {
  buildCriteria,
  buildDialogueRow,
  buildDialogueRows,
  deriveCategory,
} from '../dialogueScorecardAdapter'

function makeScorecard(overrides: Partial<Scorecard> = {}): Scorecard {
  return {
    id: 1,
    call_id: 'call-1',
    operator_id: 41,
    trainer_id: 7,
    project_id: 3,
    template_id: 2,
    template_snapshot: {
      id: 2,
      name: 'Outbound v1',
      description: null,
      call_type: 'outbound',
      department_id: null,
      sections: [
        {
          key: 'intro',
          name: 'Intro',
          criteria: [
            { key: 'greeting', name: 'Greeting', scale: '0-5', weight: 10 },
            { key: 'crm', name: 'CRM entry', scale: 'binary', weight: 5 },
          ],
        },
      ],
    },
    scores: {
      greeting: { value: 4 },
      crm: { value: true },
    },
    overall_comment: null,
    weighted_score: 82,
    status: 'completed',
    created_at: '2026-05-15T09:30:00',
    completed_at: '2026-05-15T09:40:00',
    sent_at: null,
    ...overrides,
  }
}

const OPERATORS: OperatorUser[] = [
  {
    id: 41,
    username: 'kantonova',
    full_name: 'Kateryna Antonova',
    first_name: 'Kateryna',
    middle_name: null,
    last_name: 'Antonova',
    email: 'k@example.com',
    status: 'active',
  },
]

describe('deriveCategory', () => {
  it('buckets by weighted-score band (KAN-737 §Discrepancy 2)', () => {
    expect(deriveCategory(55)).toBe('Risk')
    expect(deriveCategory(60)).toBe('Average')
    expect(deriveCategory(79)).toBe('Average')
    expect(deriveCategory(80)).toBe('New')
    expect(deriveCategory(100)).toBe('New')
  })

  it('treats a null score as New', () => {
    expect(deriveCategory(null)).toBe('New')
  })
})

describe('buildDialogueRow', () => {
  it('maps a live scorecard onto the row shape', () => {
    const lookup = new Map<number, string>([[41, 'Kateryna Antonova']])
    const row = buildDialogueRow(makeScorecard(), lookup)

    expect(row.id).toBe(1)
    expect(row.dateLabel).toBe('15.05')
    expect(row.operatorName).toBe('Kateryna Antonova')
    expect(row.operatorInitials).toBe('KA')
    expect(row.hasScore).toBe(true)
    expect(row.score).toBe(82)
    expect(row.scoreOutOf).toBe(100)
    expect(row.category).toBe('New')
    // No backend source — rendered as `—` / hidden.
    expect(row.duration).toBe('—')
    expect(row.trigger).toBe('—')
    expect(row.triggerFlags).toBeUndefined()
    expect(row.scoreDelta).toBeUndefined()
  })

  it('falls back to a #id label when the operator is unknown', () => {
    const row = buildDialogueRow(makeScorecard({ operator_id: 999 }), new Map())
    expect(row.operatorName).toBe('#999')
  })

  it('marks hasScore=false and score=0 when weighted_score is null', () => {
    const row = buildDialogueRow(makeScorecard({ weighted_score: null }), new Map())
    expect(row.hasScore).toBe(false)
    expect(row.score).toBe(0)
    expect(row.category).toBe('New')
  })

  it('rounds a fractional weighted_score', () => {
    const row = buildDialogueRow(makeScorecard({ weighted_score: 73.6 }), new Map())
    expect(row.score).toBe(74)
    expect(row.category).toBe('Average')
  })
})

describe('buildCriteria', () => {
  it('flattens sections and maps both scales onto rating bands', () => {
    const criteria = buildCriteria(makeScorecard())
    expect(criteria).toHaveLength(2)

    const greeting = criteria.find((c) => c.id === 'intro.greeting')!
    expect(greeting.label).toBe('Greeting')
    expect(greeting.weight).toBe(10)
    expect(greeting.score).toBe(4)
    expect(greeting.maxScore).toBe(5)
    expect(greeting.rating).toBe('normal') // 0-5 value 4 → normal

    const crm = criteria.find((c) => c.id === 'intro.crm')!
    expect(crm.score).toBe(1)
    expect(crm.maxScore).toBe(1)
    expect(crm.rating).toBe('excellent') // binary true → excellent
  })

  it('maps the full 0-5 band and missing/false values', () => {
    const sc = makeScorecard({
      scores: { greeting: { value: 0 }, crm: { value: false } },
    })
    const criteria = buildCriteria(sc)
    expect(criteria.find((c) => c.id === 'intro.greeting')!.rating).toBe('not_done')
    expect(criteria.find((c) => c.id === 'intro.crm')!.rating).toBe('not_done')

    const weak = buildCriteria(makeScorecard({ scores: { greeting: { value: 2 } } }))
    expect(weak.find((c) => c.id === 'intro.greeting')!.rating).toBe('weak')
    // Missing score entry defaults to not_done / 0.
    const missing = weak.find((c) => c.id === 'intro.crm')!
    expect(missing.rating).toBe('not_done')
    expect(missing.score).toBe(0)
  })
})

describe('buildDialogueRows', () => {
  it('builds the operator lookup from the roster and maps every row', () => {
    const rows = buildDialogueRows([makeScorecard(), makeScorecard({ id: 2 })], OPERATORS)
    expect(rows).toHaveLength(2)
    expect(rows[0].operatorName).toBe('Kateryna Antonova')
    expect(rows[1].id).toBe(2)
  })
})
