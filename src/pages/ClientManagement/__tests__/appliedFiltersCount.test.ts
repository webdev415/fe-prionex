/**
 * The "(N applied)" label on the client list, and the Clear All button that
 * appears with it (KAN-1119).
 *
 * RR status filtered the list correctly but was missing from the tally, so the
 * label read 0 while results were filtered, and Clear All -- which renders only
 * when the count is above zero -- never appeared. Both symptoms came from the
 * one omission, so counting it fixes both.
 *
 * These call the page's own countAppliedFilters rather than restating its rules,
 * so deleting the RR status line fails them.
 */

import { describe, it, expect } from 'vitest'
import type { ClientFilters } from '../ClientManagementPage'
import { countAppliedFilters } from '../utils/appliedFiltersCount'

const NONE: ClientFilters = {}
const NO_PRIORITIES: string[] = []
const NO_BUCKETS: string[] = []

const count = (filters: ClientFilters) => countAppliedFilters(filters, NO_PRIORITIES, NO_BUCKETS)

describe('the applied-filters count', () => {
  it('is zero when nothing is applied', () => {
    expect(count(NONE)).toBe(0)
  })

  it('counts an RR status, so the label and Clear All both appear', () => {
    expect(count({ rrStatusIds: [2] })).toBe(1)
  })

  it('counts an RR status once however many are ticked', () => {
    // One per group, the rule every other multi-select here follows.
    expect(count({ rrStatusIds: [1, 2, 3] })).toBe(1)
  })

  it('counts "Without RR" too, though its id is the falsy 0', () => {
    // KAN-1054 added a seventh option whose value is 0. The tally keys on the
    // list's length, not on the ids, so it is counted like any other.
    expect(count({ rrStatusIds: [0] })).toBe(1)
  })

  it('counts tags the same way -- the convention RR status now matches', () => {
    // The control: if this ever counted per value, the rule above would be
    // wrong rather than RR status being inconsistent with it.
    expect(count({ tagIds: [1, 2, 3] })).toBe(1)
  })

  it('adds to the filters beside it rather than replacing them', () => {
    expect(count({ tagIds: [7], rrStatusIds: [2] })).toBe(2)
  })

  it('stops counting once the statuses are cleared', () => {
    // What Clear All leaves behind: handleClearAll empties rrStatusFilter, and
    // the button disappears only if an empty list counts as nothing applied.
    expect(count({ rrStatusIds: [] })).toBe(0)
  })
})
