/**
 * Tests for coversAllOptions — the guard that decides whether an operator
 * multi-select filter covers every option and can therefore be OMITTED from the
 * API request (the fix that keeps an "all operators" selection off the heavy
 * 200-id IN-list query path).
 */

import { describe, it, expect } from 'vitest'
import { coversAllOptions } from '../useOperatorFilterOptions'

describe('coversAllOptions', () => {
  it('returns true when the selection covers every option', () => {
    expect(coversAllOptions([1, 2, 3], [1, 2, 3])).toBe(true)
  })

  it('is order-independent', () => {
    expect(coversAllOptions([3, 1, 2], [1, 2, 3])).toBe(true)
  })

  it('returns true when the selection is a superset of the options', () => {
    // Extra ids (e.g. a stale id no longer in the option set) still count as
    // "all covered" — every current option is selected.
    expect(coversAllOptions([1, 2, 3, 99], [1, 2, 3])).toBe(true)
  })

  it('returns false when at least one option is unselected', () => {
    expect(coversAllOptions([1, 2], [1, 2, 3])).toBe(false)
  })

  it('returns false for an empty option set (options not loaded yet)', () => {
    // Guards the race where the option lists have not resolved: we must not
    // mistake "no options known" for "all selected" and wrongly omit the filter.
    expect(coversAllOptions([1, 2, 3], [])).toBe(false)
    expect(coversAllOptions([], [])).toBe(false)
  })

  it('returns false when nothing is selected but options exist', () => {
    expect(coversAllOptions([], [1, 2, 3])).toBe(false)
  })
})
