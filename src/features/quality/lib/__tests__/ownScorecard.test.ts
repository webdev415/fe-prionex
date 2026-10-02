/**
 * Which card on a call a trainer opens (KAN-1050).
 *
 * A call now carries one card per evaluator. The editor used to open the
 * newest card on the call regardless of who made it, so whoever looked second
 * was handed their colleague's assessment — which they overwrote before the
 * API started refusing it, and get a 403 on afterwards.
 *
 * Asserting on the id matters: picking "the first history entry" passes
 * whenever the viewer happens to be the latest evaluator, which is every
 * single-evaluator call.
 */
import { describe, it, expect } from 'vitest'

import { ownScorecardId } from '../ownScorecard'
import type { ScorecardHistoryItem } from '../../types'

const card = (id: number, trainer_id: number): ScorecardHistoryItem => ({
  id,
  trainer_id,
  weighted_score: null,
  status: 'draft',
  created_at: '2026-10-02T09:00:00Z',
  completed_at: null,
  sent_at: null,
})

// Newest first, as the endpoint returns them: a colleague scored last.
const HISTORY = [card(30, 99), card(20, 7), card(10, 99)]

describe('ownScorecardId', () => {
  it("picks the viewer's card, not the newest on the call", () => {
    expect(ownScorecardId(HISTORY, 7)).toBe(20)
  })

  it("picks the viewer's most recent card when they have several", () => {
    expect(ownScorecardId(HISTORY, 99)).toBe(30)
  })

  it('returns null when the viewer has not scored the call', () => {
    expect(ownScorecardId(HISTORY, 42)).toBeNull()
  })

  it('accepts a string id, as the auth store holds it', () => {
    expect(ownScorecardId(HISTORY, '7')).toBe(20)
  })

  it('returns null rather than guessing while the viewer is unresolved', () => {
    expect(ownScorecardId(HISTORY, null)).toBeNull()
    expect(ownScorecardId(HISTORY, undefined)).toBeNull()
    expect(ownScorecardId(HISTORY, 'not-a-number')).toBeNull()
  })

  it('handles an empty or missing history', () => {
    expect(ownScorecardId([], 7)).toBeNull()
    expect(ownScorecardId(undefined, 7)).toBeNull()
  })
})
