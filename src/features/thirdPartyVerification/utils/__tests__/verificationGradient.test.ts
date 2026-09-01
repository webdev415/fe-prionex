import { describe, it, expect } from 'vitest'
import {
  planDiffTone,
  toFiniteNumber,
  verificationCellBackground,
  verificationGradientBounds,
} from '../verificationGradient'

describe('toFiniteNumber', () => {
  it.each([
    [5, 5],
    [0, 0],
    [-3.5, -3.5],
    ['1198.8', 1198.8],
    ['-298.8', -298.8],
  ])('accepts %p', (input, expected) => {
    expect(toFiniteNumber(input as number | string)).toBe(expected)
  })

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['an empty string', ''],
    ['whitespace', '   '],
    ['a non-numeric string', 'abc'],
  ])('rejects %s', (_case, input) => {
    // An empty string would otherwise become 0 via Number('') and fake a real
    // value; undefined would crash any arithmetic downstream.
    expect(toFiniteNumber(input as number | string | null | undefined)).toBeNull()
  })
})

describe('verificationGradientBounds', () => {
  it('takes the largest plan and the client column min/max', () => {
    expect(
      verificationGradientBounds([
        { numbers_added: 10, unique_clients: 5, month_plan: 100 },
        { numbers_added: 20, unique_clients: 40, month_plan: '250.5' },
        { numbers_added: 30, unique_clients: 12, month_plan: 80 },
      ])
    ).toEqual({ maxPlan: 250.5, minClients: 5, maxClients: 40 })
  })

  it('skips unusable values instead of poisoning the scale', () => {
    expect(
      verificationGradientBounds([
        { numbers_added: 10, unique_clients: 5, month_plan: null },
        {
          numbers_added: 20,
          unique_clients: undefined,
          month_plan: 'oops',
        } as unknown as { numbers_added: number; unique_clients: number; month_plan: null },
        { numbers_added: 30, unique_clients: 12, month_plan: 90 },
      ])
    ).toEqual({ maxPlan: 90, minClients: 5, maxClients: 12 })
  })

  it('falls back to zeroes for an empty data set', () => {
    expect(verificationGradientBounds([])).toEqual({ maxPlan: 0, minClients: 0, maxClients: 0 })
  })
})

describe('verificationCellBackground', () => {
  it('returns no fill for unusable values', () => {
    expect(verificationCellBackground(null, 0, 100)).toBeUndefined()
    expect(verificationCellBackground(undefined, 0, 100)).toBeUndefined()
  })

  it('moves along the red → green ramp with the value', () => {
    const low = verificationCellBackground(0, 0, 100)
    const high = verificationCellBackground(100, 0, 100)
    expect(low).toBeDefined()
    expect(high).toBeDefined()
    expect(low).not.toBe(high)
  })

  it('returns the neutral colour for a degenerate scale', () => {
    // Every operator on the same number (or no plan at all) carries no
    // ranking information — all cells must look the same, not red.
    expect(verificationCellBackground(7, 7, 7)).toBe(verificationCellBackground(7, 0, 0))
  })
})

describe('planDiffTone', () => {
  it.each([
    [-1, 'negative'],
    ['-298.8', 'negative'],
    [0, 'positive'],
    [12, 'positive'],
  ])('maps %p to %s', (value, tone) => {
    expect(planDiffTone(value as number | string)).toBe(tone)
  })

  it('has no tone for a missing value', () => {
    expect(planDiffTone(null)).toBeNull()
    expect(planDiffTone(undefined)).toBeNull()
  })
})
