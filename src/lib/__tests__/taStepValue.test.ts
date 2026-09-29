/**
 * Reading the value recorded for one chain step.
 *
 * The defect this pins: a step that was **skipped** displayed the value of the
 * step after it. `step_data` is keyed by `step_order`, but reading fell back to
 * `target_action_id` for legacy rows — and both are small integers in one flat
 * key namespace, so a skipped step at order 2 whose action id is 3 borrowed
 * whatever the step at order 3 had recorded.
 *
 * Same collision as the filter defect in KAN-1090; this is the display half.
 */
import { describe, it, expect } from 'vitest'
import { readStepValue } from '../taStepValue'

// The shape that reproduces it: the date step sits at order 2, and its action
// id (3) is also the order of the step after it.
const CHAIN = [
  { step_order: 1, target_action_id: 2 },
  { step_order: 2, target_action_id: 3 }, // the date step
  { step_order: 3, target_action_id: 4 },
]
const DATE_STEP = CHAIN[1]

describe('readStepValue — a skipped step', () => {
  it("shows nothing, not the next step's value", () => {
    const recorded = { '1': 'A', '3': 'TEXT-FROM-STEP-3' }
    expect(readStepValue(recorded, DATE_STEP, CHAIN)).toBeUndefined()
  })

  it('still reads its own value when it has one', () => {
    const recorded = { '2': '2026-10-01', '3': 'TEXT-FROM-STEP-3' }
    expect(readStepValue(recorded, DATE_STEP, CHAIN)).toBe('2026-10-01')
  })

  it('does not borrow across a chain where nothing was recorded for it', () => {
    expect(readStepValue({ '3': 'x' }, DATE_STEP, CHAIN)).toBeUndefined()
  })
})

describe('readStepValue — legacy rows keyed by action id', () => {
  it('still reads them when no step sits at that order', () => {
    // Action id 9 names no step order in this chain, so the key is unambiguous.
    const chain = [{ step_order: 1, target_action_id: 9 }]
    expect(readStepValue({ '9': 'legacy' }, chain[0], chain)).toBe('legacy')
  })

  it('prefers the step_order key when both are present', () => {
    const chain = [{ step_order: 1, target_action_id: 9 }]
    expect(readStepValue({ '1': 'current', '9': 'legacy' }, chain[0], chain)).toBe('current')
  })

  it('declines the legacy key when it collides with a real step order', () => {
    // This is the whole fix: id 3 is also order 3 here, so "3" cannot be read
    // as belonging to the step at order 2.
    expect(readStepValue({ '3': 'belongs to order 3' }, DATE_STEP, CHAIN)).toBeUndefined()
  })
})

describe('readStepValue — edges', () => {
  it('handles no step data at all', () => {
    expect(readStepValue(null, DATE_STEP, CHAIN)).toBeUndefined()
    expect(readStepValue(undefined, DATE_STEP, CHAIN)).toBeUndefined()
  })

  it('returns a falsy recorded value as itself, not as missing', () => {
    // An empty string is a recorded answer; it must not fall through to the
    // legacy key and pick up a neighbour's value.
    expect(readStepValue({ '2': '', '3': 'other' }, DATE_STEP, CHAIN)).toBe('')
  })
})
