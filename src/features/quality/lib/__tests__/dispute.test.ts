/**
 * Dispute rules — the threshold comes from the API, never from a hardcoded
 * number in a component, and the reason field only appears strictly past it.
 */
import { describe, it, expect } from 'vitest'
import {
  DEFAULT_DISPUTE_THRESHOLD,
  isDisputeReasonRequested,
  resolveDisputeThreshold,
  scoreDivergence,
  trainerScoreTo100,
} from '../dispute'

describe('trainerScoreTo100', () => {
  it('lifts the backend 0-5 axis onto the 0-100 display axis', () => {
    expect(trainerScoreTo100(2.25)).toBe(45)
    expect(trainerScoreTo100(0)).toBe(0)
    expect(trainerScoreTo100(5)).toBe(100)
  })

  it('passes absence through rather than inventing a zero', () => {
    expect(trainerScoreTo100(null)).toBeNull()
    expect(trainerScoreTo100(undefined)).toBeNull()
    expect(trainerScoreTo100(Number.NaN)).toBeNull()
  })
})

describe('resolveDisputeThreshold', () => {
  it('takes the threshold the backend sent', () => {
    expect(resolveDisputeThreshold({ dispute_threshold: 25 })).toBe(25)
    expect(resolveDisputeThreshold({ dispute_threshold: 0 })).toBe(0)
  })

  it('falls back to the default when the backend sent none', () => {
    expect(resolveDisputeThreshold(null)).toBe(DEFAULT_DISPUTE_THRESHOLD)
    expect(resolveDisputeThreshold(undefined)).toBe(DEFAULT_DISPUTE_THRESHOLD)
    expect(resolveDisputeThreshold({})).toBe(DEFAULT_DISPUTE_THRESHOLD)
    expect(resolveDisputeThreshold({ dispute_threshold: null })).toBe(DEFAULT_DISPUTE_THRESHOLD)
  })

  it('ignores a nonsensical threshold instead of trusting it', () => {
    // A negative would make |delta| > threshold true for every scorecard, so
    // the reason field would follow trainers around forever.
    expect(resolveDisputeThreshold({ dispute_threshold: -5 })).toBe(DEFAULT_DISPUTE_THRESHOLD)
    expect(resolveDisputeThreshold({ dispute_threshold: Number.NaN })).toBe(
      DEFAULT_DISPUTE_THRESHOLD
    )
  })
})

describe('scoreDivergence', () => {
  it('is signed — positive when the trainer scored higher than the AI', () => {
    expect(scoreDivergence(0, 45)).toBe(45)
    expect(scoreDivergence(90, 60)).toBe(-30)
    expect(scoreDivergence(50, 50)).toBe(0)
  })

  it('is null when either side is missing', () => {
    expect(scoreDivergence(null, 45)).toBeNull()
    expect(scoreDivergence(45, null)).toBeNull()
    expect(scoreDivergence(undefined, undefined)).toBeNull()
  })
})

describe('isDisputeReasonRequested', () => {
  const threshold = 10

  it('stays quiet below the threshold', () => {
    expect(isDisputeReasonRequested(50, 50, threshold)).toBe(false)
    expect(isDisputeReasonRequested(50, 59, threshold)).toBe(false)
  })

  it('asks once the gap reaches the threshold', () => {
    // The boundary counts, matching the backend's `abs(score_delta) >=
    // threshold`. Disagreeing on which side of `==` we sit would put the
    // field on screen for a scorecard the backend does not call a dispute.
    expect(isDisputeReasonRequested(50, 60, threshold)).toBe(true)
    expect(isDisputeReasonRequested(50, 61, threshold)).toBe(true)
    expect(isDisputeReasonRequested(0, 45, threshold)).toBe(true)
  })

  it('treats scoring far lower than the AI as an objection too', () => {
    expect(isDisputeReasonRequested(90, 40, threshold)).toBe(true)
  })

  it('never asks when there is nothing to compare against', () => {
    expect(isDisputeReasonRequested(null, 45, threshold)).toBe(false)
    expect(isDisputeReasonRequested(45, null, threshold)).toBe(false)
  })

  it('honours a threshold the backend widened', () => {
    // Same 45-point gap, backend says 50 — no field.
    expect(isDisputeReasonRequested(0, 45, 50)).toBe(false)
    expect(isDisputeReasonRequested(0, 50, 50)).toBe(true)
  })
})
