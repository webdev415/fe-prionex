import { describe, it, expect } from 'vitest'
import {
  localDateStringsToIsoRange,
  analyticsRangeExceedsCap,
  MAX_ANALYTICS_RANGE_DAYS,
} from '../dateRange'

describe('localDateStringsToIsoRange', () => {
  it('spans start-of-day to end-of-day as ISO', () => {
    const { from_datetime, to_datetime } = localDateStringsToIsoRange('2026-01-01', '2026-01-01')
    expect(from_datetime).toMatch(/T.*Z$/)
    expect(to_datetime).toMatch(/T.*Z$/)
    expect(new Date(to_datetime).getTime()).toBeGreaterThan(new Date(from_datetime).getTime())
  })
})

describe('analyticsRangeExceedsCap', () => {
  it('allows a single day', () => {
    expect(analyticsRangeExceedsCap('2026-01-01', '2026-01-01')).toBe(false)
  })

  it('allows exactly the cap (31 inclusive calendar days)', () => {
    // 2026-01-01 .. 2026-01-31 = 31 inclusive days, within the cap.
    expect(analyticsRangeExceedsCap('2026-01-01', '2026-01-31')).toBe(false)
  })

  it('rejects one day past the cap', () => {
    // 2026-01-01 .. 2026-02-01 = 32 inclusive days, over the cap.
    expect(analyticsRangeExceedsCap('2026-01-01', '2026-02-01')).toBe(true)
  })

  it('rejects a wide (~90-day) range', () => {
    expect(analyticsRangeExceedsCap('2026-04-14', '2026-07-13')).toBe(true)
  })

  it('cap constant is 31', () => {
    expect(MAX_ANALYTICS_RANGE_DAYS).toBe(31)
  })
})
