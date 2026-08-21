import { describe, expect, it } from 'vitest'

import { validateRange, type RangeFormState } from '../coefficientRangeValidation'

// Returns the fallback so assertions read against wording, not key names.
const t = (_key: string, fallback: string) => fallback

const valid: RangeFormState = {
  min_days: '1',
  max_days: '30',
  min_coefficient: '1.5',
  max_coefficient: '2.0',
}

const form = (over: Partial<RangeFormState> = {}): RangeFormState => ({ ...valid, ...over })

describe('validateRange — days', () => {
  it('accepts a well-formed range', () => {
    expect(validateRange(valid, t)).toBeNull()
  })

  it.each([
    ['empty', ''],
    ['whitespace only', '   '],
    ['exponent notation', '1e3'],
    ['hex', '0x10'],
    ['decimal', '1.5'],
    ['negative', '-1'],
  ])('rejects %s', (_label, value) => {
    // Number() coerces all of these to a finite integer ("" and "   " to 0),
    // and Number.isInteger() then passes them — so an empty form would have
    // saved as the range 0-0 with no error. The check runs on the raw string.
    expect(validateRange(form({ min_days: value }), t)).toMatch(/whole numbers/i)
    expect(validateRange(form({ max_days: value }), t)).toMatch(/whole numbers/i)
  })

  it('accepts zero, which is a legitimate lower bound', () => {
    expect(validateRange(form({ min_days: '0' }), t)).toBeNull()
  })

  it('rejects min greater than max', () => {
    expect(validateRange(form({ min_days: '30', max_days: '1' }), t)).toMatch(/exceed/i)
  })

  it('accepts min equal to max — a single-day range', () => {
    expect(validateRange(form({ min_days: '7', max_days: '7' }), t)).toBeNull()
  })
})

describe('validateRange — coefficients', () => {
  it.each([
    ['two decimals', '1.55'],
    ['empty', ''],
    ['not a number', 'abc'],
  ])('rejects %s', (_label, value) => {
    expect(validateRange(form({ min_coefficient: value }), t)).toMatch(/decimal place/i)
  })

  it.each([
    ['below the floor', '0.9'],
    ['above the ceiling', '10.1'],
  ])('rejects %s', (_label, value) => {
    expect(validateRange(form({ min_coefficient: value, max_coefficient: '10.0' }), t)).toMatch(
      /1\.0/
    )
  })

  it.each(['1.0', '10.0'])('accepts the inclusive bound %s', (value) => {
    expect(validateRange(form({ min_coefficient: value, max_coefficient: '10.0' }), t)).toBeNull()
  })

  it('rejects min greater than max', () => {
    expect(validateRange(form({ min_coefficient: '3.0', max_coefficient: '2.0' }), t)).toMatch(
      /exceed/i
    )
  })
})
