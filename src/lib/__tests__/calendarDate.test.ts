import { describe, it, expect } from 'vitest'
import { isRealCalendarDate } from '../calendarDate'

describe('isRealCalendarDate', () => {
  it('accepts real calendar days, including a leap-year 29 February', () => {
    expect(isRealCalendarDate('2026-01-01')).toBe(true)
    expect(isRealCalendarDate('2026-12-31')).toBe(true)
    expect(isRealCalendarDate('2024-02-29')).toBe(true)
  })

  it('rejects a day the month does not have (the parser would roll it over)', () => {
    // `new Date(2026, 1, 31)` silently becomes 03.03.2026 — the picker would
    // then show a different day than the URL carries.
    expect(isRealCalendarDate('2026-02-31')).toBe(false)
    expect(isRealCalendarDate('2026-04-31')).toBe(false)
    expect(isRealCalendarDate('2026-02-29')).toBe(false)
  })

  it('rejects out-of-range months and days', () => {
    expect(isRealCalendarDate('2026-13-01')).toBe(false)
    expect(isRealCalendarDate('2026-00-10')).toBe(false)
    expect(isRealCalendarDate('2026-01-00')).toBe(false)
    expect(isRealCalendarDate('2026-01-32')).toBe(false)
  })

  it('rejects anything that is not exactly YYYY-MM-DD', () => {
    expect(isRealCalendarDate('')).toBe(false)
    expect(isRealCalendarDate('2026-1-1')).toBe(false)
    expect(isRealCalendarDate('01.01.2026')).toBe(false)
    expect(isRealCalendarDate('2026-01-01T00:00:00Z')).toBe(false)
    expect(isRealCalendarDate('not-a-date')).toBe(false)
  })
})
