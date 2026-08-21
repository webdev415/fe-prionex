/**
 * normalizeCriterionScale — tolerant reader for a stored criterion scale.
 *
 * The API accepts only `binary` and `0-5`. `binary_critical` exists in the
 * pipeline's rubric.json, where criticality is a scale; in the database it is
 * `binary` + the separate `critical` flag. Neither dev nor prod holds it
 * today (checked: 0 rows in templates and 0 in frozen scorecard snapshots),
 * so this guards against data written by something other than this UI.
 */
import { describe, expect, it } from 'vitest'

import { normalizeCriterionScale } from '../../types'

describe('normalizeCriterionScale', () => {
  it('passes the two real scales through', () => {
    expect(normalizeCriterionScale('binary')).toBe('binary')
    expect(normalizeCriterionScale('0-5')).toBe('0-5')
  })

  it('degrades binary_critical to the yes/no control it really is', () => {
    // Not '0-5': a criticality-flavoured binary is still binary, and falling
    // through to the 0..5 band would render six buttons where two belong.
    expect(normalizeCriterionScale('binary_critical')).toBe('binary')
  })

  it('falls back to 0-5 for anything unrecognised, including absent values', () => {
    expect(normalizeCriterionScale('yes_no')).toBe('0-5')
    expect(normalizeCriterionScale('')).toBe('0-5')
    expect(normalizeCriterionScale(null)).toBe('0-5')
    expect(normalizeCriterionScale(undefined)).toBe('0-5')
  })
})
