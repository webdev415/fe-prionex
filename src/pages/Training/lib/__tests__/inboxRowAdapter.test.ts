/**
 * Trigger-label localization for the Inbox card adapter. BE returns opaque
 * trigger codes; `triggerLabel` must translate the known ones via
 * `pages.training.inbox.triggers.<code>` and fall back to the humanized code
 * for anything unmapped so a brand-new BE rule never renders as a raw slug.
 */
import { describe, it, expect } from 'vitest'
import type { OperatorUser } from '@/features/users/api/usersApi'
import type { QueueOperator } from '@/features/quality/coaching/types'
import { deriveInboxRow, triggerLabel } from '../inboxRowAdapter'

/** Fake i18next `t` — resolves from `dict`, else the passed `defaultValue`. */
function makeT(dict: Record<string, string> = {}) {
  return (key: string, opts?: Record<string, unknown>): string =>
    dict[key] ?? (opts?.defaultValue as string | undefined) ?? key
}

const TRANSLATED = {
  'pages.training.inbox.triggers.low_script_adherence': 'Low script adherence',
  'pages.training.inbox.triggers.missed_calls': 'Missed Calls',
}

function makeQueueOperator(overrides: Partial<QueueOperator> = {}): QueueOperator {
  return {
    operator_id: 7,
    composite_score: 55,
    score_band: 'amber',
    assignment: null,
    kpis: {
      script_adherence_pct: null,
      avg_scorecard_pct: null,
      conversion_rate: null,
      task_completion_on_time_pct: null,
      red_flag_count: 0,
    },
    triggers: [],
    last_active_at: null,
    ...overrides,
  }
}

describe('triggerLabel', () => {
  it('translates a known trigger code from the dictionary', () => {
    const t = makeT(TRANSLATED)
    expect(triggerLabel(t, 'low_script_adherence')).toBe('Low script adherence')
    expect(triggerLabel(t, 'missed_calls')).toBe('Missed Calls')
  })

  it('falls back to the humanized code when the key is missing', () => {
    const t = makeT() // empty dict → defaultValue wins
    expect(triggerLabel(t, 'brand_new_rule')).toBe('Brand New Rule')
    expect(triggerLabel(t, 'silence')).toBe('Silence')
  })
})

describe('deriveInboxRow trigger labels', () => {
  it('localizes trigger tags and card summary through the dictionary', () => {
    const t = makeT(TRANSLATED)
    const operators: OperatorUser[] = []
    const row = deriveInboxRow(
      t,
      makeQueueOperator({ triggers: ['low_script_adherence'] }),
      operators
    )

    expect(row.triggerTags[0].label).toBe('Low script adherence')
    expect(row.triggers[0].label).toBe('Low script adherence')
    expect(row.cardSummary.startsWith('Low script adherence')).toBe(true)
  })

  it('humanizes an unmapped trigger code end-to-end', () => {
    const t = makeT()
    const row = deriveInboxRow(t, makeQueueOperator({ triggers: ['weird_new_code'] }), [])

    expect(row.triggerTags[0].label).toBe('Weird New Code')
  })
})
