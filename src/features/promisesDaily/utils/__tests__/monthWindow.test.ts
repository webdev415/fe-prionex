import { describe, expect, it } from 'vitest'
import { endOfMonthYMD, startOfMonthYMD } from '../monthWindow'

// Pure string math — no Date parsing of the input, so nothing here can shift
// with the host timezone.

describe('startOfMonthYMD', () => {
  it('returns the first day of the same month', () => {
    expect(startOfMonthYMD('2026-07-15')).toBe('2026-07-01')
    expect(startOfMonthYMD('2026-12-31')).toBe('2026-12-01')
  })

  it('is a fixed point on the first day itself', () => {
    expect(startOfMonthYMD('2026-07-01')).toBe('2026-07-01')
  })
})

describe('endOfMonthYMD', () => {
  it('returns the last day for 31- and 30-day months', () => {
    expect(endOfMonthYMD('2026-07-15')).toBe('2026-07-31')
    expect(endOfMonthYMD('2026-09-07')).toBe('2026-09-30')
  })

  it('handles February in common and leap years', () => {
    expect(endOfMonthYMD('2026-02-10')).toBe('2026-02-28')
    expect(endOfMonthYMD('2028-02-10')).toBe('2028-02-29')
  })

  it('handles December without rolling the year', () => {
    expect(endOfMonthYMD('2026-12-05')).toBe('2026-12-31')
  })

  it('is a fixed point on the last day itself', () => {
    expect(endOfMonthYMD('2026-07-31')).toBe('2026-07-31')
  })
})
