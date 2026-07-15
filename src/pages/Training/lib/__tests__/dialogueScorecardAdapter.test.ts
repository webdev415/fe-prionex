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
  type CallContactInfo,
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
    // 0-5 axis (backend); the adapter ×20 → 82/100.
    weighted_score: 4.1,
    status: 'completed',
    created_at: '2026-05-15T09:30:00',
    completed_at: '2026-05-15T09:40:00',
    sent_at: null,
    call_started_at: null,
    call_talk_duration: null,
    call_telephony_type: null,
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
  it('buckets by 0-100 score band (Low < 60 · Average 60-79 · High >= 80)', () => {
    expect(deriveCategory(55)).toBe('Low')
    expect(deriveCategory(60)).toBe('Average')
    expect(deriveCategory(79)).toBe('Average')
    expect(deriveCategory(80)).toBe('High')
    expect(deriveCategory(100)).toBe('High')
  })

  it('treats a null (unscored) score as Unscored', () => {
    expect(deriveCategory(null)).toBe('Unscored')
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
    expect(row.score).toBe(82) // 4.1 × 20
    expect(row.scoreOutOf).toBe(100)
    expect(row.category).toBe('High')
  })

  it('falls back to a #id label when the operator is unknown', () => {
    const row = buildDialogueRow(makeScorecard({ operator_id: 999 }), new Map())
    expect(row.operatorName).toBe('#999')
  })

  it('marks hasScore=false, score=0, category Unscored when weighted_score is null', () => {
    const row = buildDialogueRow(makeScorecard({ weighted_score: null }), new Map())
    expect(row.hasScore).toBe(false)
    expect(row.score).toBe(0)
    expect(row.category).toBe('Unscored')
  })

  it('scales the 0-5 weighted_score ×20 and rounds to /100', () => {
    const row = buildDialogueRow(makeScorecard({ weighted_score: 3.68 }), new Map())
    expect(row.score).toBe(74) // 3.68 × 20 = 73.6 → 74
    expect(row.category).toBe('Average')
  })

  it('leaves contact/client fields null when no call lookup is provided', () => {
    const row = buildDialogueRow(makeScorecard(), new Map())
    expect(row.contactedPhone).toBeNull()
    expect(row.clientId).toBeNull()
    expect(row.clientName).toBeNull()
  })

  it('maps contacted phone + linked client name from the lookups', () => {
    const callLookup = new Map<string, CallContactInfo>([
      ['call-1', { customer_number: '0638446901', client_id: 42 }],
    ])
    const clientNames = new Map<number, string>([[42, 'Ivanov Ivan']])
    const row = buildDialogueRow(makeScorecard(), new Map(), callLookup, clientNames)
    expect(row.contactedPhone).toBe('0638446901')
    expect(row.clientId).toBe(42)
    expect(row.clientName).toBe('Ivanov Ivan')
  })

  it('keeps the phone but nulls client when the call has no client_id', () => {
    const callLookup = new Map<string, CallContactInfo>([
      ['call-1', { customer_number: '0638446902', client_id: null }],
    ])
    const row = buildDialogueRow(makeScorecard(), new Map(), callLookup, new Map())
    expect(row.contactedPhone).toBe('0638446902')
    expect(row.clientId).toBeNull()
    expect(row.clientName).toBeNull()
  })

  it('links the client by id even before its name resolves', () => {
    const callLookup = new Map<string, CallContactInfo>([
      ['call-1', { customer_number: '0638446903', client_id: 42 }],
    ])
    // Name map empty → clientId present so the table can still render a link.
    const row = buildDialogueRow(makeScorecard(), new Map(), callLookup, new Map())
    expect(row.clientId).toBe(42)
    expect(row.clientName).toBeNull()
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

  it('excludes the script_stages section from the quality breakdown', () => {
    const sc = makeScorecard({
      template_snapshot: {
        id: 2,
        name: 'Client Dialogue',
        description: null,
        call_type: null,
        department_id: null,
        sections: [
          {
            key: 'client_dialogue',
            name: 'Client Dialogue',
            criteria: [{ key: 'greeting', name: 'Greeting', scale: '0-5', weight: 5 }],
          },
          {
            key: 'script_stages',
            name: 'Script stages',
            criteria: [{ key: 'stage_greeting', name: 'Greeting', scale: 'binary', weight: 0 }],
          },
        ],
      },
      scores: { greeting: { value: 4 }, stage_greeting: { value: true } },
    })
    const criteria = buildCriteria(sc)
    expect(criteria.map((c) => c.id)).toEqual(['client_dialogue.greeting'])
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
