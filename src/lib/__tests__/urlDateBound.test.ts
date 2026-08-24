/**
 * Unit tests for the URL date-bound primitives.
 *
 * Moved here with the functions themselves (they used to sit inside the
 * paged-feed hook): nothing they do involves React, the router or paging, so
 * they are tested as the plain functions they are.
 */

import { describe, expect, it } from 'vitest'
import { isDatePairInverted, readUrlDateBound } from '../urlDateBound'

describe('readUrlDateBound', () => {
  it('reads a real calendar date', () => {
    expect(readUrlDateBound(new URLSearchParams('?d=2026-08-05'), 'd')).toEqual({
      isInvalid: false,
      value: '2026-08-05',
    })
  })

  it('treats an absent or empty key as a plain "no value", not an error', () => {
    expect(readUrlDateBound(new URLSearchParams(''), 'd')).toEqual({
      isInvalid: false,
      value: undefined,
    })
    expect(readUrlDateBound(new URLSearchParams('?d='), 'd')).toEqual({
      isInvalid: false,
      value: undefined,
    })
  })

  it.each([
    // A shape-only check would let an impossible day through: V8's Date.parse
    // lazily reads 2026-02-31 as March 3rd, so every downstream comparison
    // would "work" on a day nobody typed.
    ['a day the month does not have', '2026-02-31'],
    ['a malformed value', 'not-a-date'],
    ['a wrong shape', '05.08.2026'],
  ])('flags %s as invalid without substituting a value', (_case, raw) => {
    // The caller shows an empty field with the hint on it — never the raw bad
    // value standing in as if it were usable, and never a silent default.
    expect(readUrlDateBound(new URLSearchParams({ d: raw }), 'd')).toEqual({
      isInvalid: true,
      value: undefined,
    })
  })
})

describe('isDatePairInverted', () => {
  it('is true only for a fully specified, inverted pair', () => {
    expect(isDatePairInverted('2026-08-10', '2026-08-01')).toBe(true)
    expect(isDatePairInverted('2026-08-01', '2026-08-10')).toBe(false)
    expect(isDatePairInverted('2026-08-01', '2026-08-01')).toBe(false)
    // A single bound is a legitimate open-ended filter.
    expect(isDatePairInverted('2026-08-10', undefined)).toBe(false)
    expect(isDatePairInverted(undefined, '2026-08-01')).toBe(false)
    expect(isDatePairInverted(undefined, undefined)).toBe(false)
  })
})
