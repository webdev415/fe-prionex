import { describe, expect, it } from 'vitest'
import {
  EMPTY,
  formatCalendarDay,
  formatClock,
  formatCount,
  formatHours,
  formatMinutes,
  defaultWorkmonth,
  isValidMonth,
  parseYmd,
  secondsToMinutes,
} from '../format'

describe('secondsToMinutes / formatMinutes', () => {
  it('rounds seconds to whole minutes with Math.round (TF rule), half up', () => {
    expect(secondsToMinutes(0)).toBe(0)
    expect(secondsToMinutes(29)).toBe(0)
    expect(secondsToMinutes(30)).toBe(1)
    expect(secondsToMinutes(89)).toBe(1)
    expect(secondsToMinutes(90)).toBe(2)
    // workday-breaks.json: the 3854 s break is 64 min, the 6124 s total 102.
    expect(secondsToMinutes(3854)).toBe(64)
    expect(secondsToMinutes(6124)).toBe(102)
    // The red threshold in `meta`: 4800 s = 80 min exactly.
    expect(secondsToMinutes(4800)).toBe(80)
  })

  it('renders «—» for null, undefined and non-finite values, never NaN', () => {
    for (const value of [null, undefined, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(secondsToMinutes(value)).toBeNull()
      expect(formatMinutes(value, 'uk')).toBe(EMPTY)
    }
    expect(formatMinutes(0, 'uk')).toBe('0')
    expect(formatMinutes(6124, 'en')).toBe('102')
  })
})

describe('formatHours', () => {
  it('shows working time in hours with one decimal', () => {
    // 29004 s = 8.0567 h
    expect(formatHours(29004, 'en')).toBe('8.1')
    expect(formatHours(0, 'en')).toBe('0.0')
    expect(formatHours(29004, 'uk')).toBe('8,1')
  })

  it('renders «—» for a missing value', () => {
    expect(formatHours(null, 'uk')).toBe(EMPTY)
    expect(formatHours(undefined, 'uk')).toBe(EMPTY)
  })
})

describe('formatCount', () => {
  it('keeps a real zero and dashes a missing value', () => {
    expect(formatCount(0, 'uk')).toBe('0')
    expect(formatCount(null, 'uk')).toBe(EMPTY)
    expect(formatCount(undefined, 'uk')).toBe(EMPTY)
  })
})

describe('formatClock', () => {
  it('reads a UTC instant on the Kyiv clock, not the process zone (UTC in tests)', () => {
    // Summer (EEST, UTC+3)
    expect(formatClock('2026-09-17T05:58:03.412000Z', 'uk', 'Europe/Kyiv')).toBe('08:58')
    // Winter (EET, UTC+2) — no hard-coded +3
    expect(formatClock('2026-12-01T05:58:00Z', 'uk', 'Europe/Kyiv')).toBe('07:58')
  })

  it('is a 24 h clock in every UI language', () => {
    expect(formatClock('2026-09-17T15:01:27Z', 'en', 'Europe/Kyiv')).toBe('18:01')
    expect(formatClock('2026-09-17T21:30:00Z', 'en', 'Europe/Kyiv')).toBe('00:30')
  })

  it('renders «—» for null and garbage, and survives an unusable zone', () => {
    expect(formatClock(null, 'uk', 'Europe/Kyiv')).toBe(EMPTY)
    expect(formatClock('not-a-date', 'uk', 'Europe/Kyiv')).toBe(EMPTY)
    expect(formatClock('2026-09-17T05:58:03Z', 'uk', 'Europe/Atlantis')).toBe('08:58')
  })
})

describe('calendar days and months', () => {
  it('formats a YYYY-MM-DD day without a UTC shift', () => {
    expect(formatCalendarDay('2026-09-17', 'uk')).toBe('17.09.2026')
    expect(formatCalendarDay(null, 'uk')).toBe(EMPTY)
  })

  it('rejects impossible days instead of rolling them over', () => {
    expect(parseYmd('2026-02-30')).toBeNull()
    expect(parseYmd('2026-9-1')).toBeNull()
    expect(parseYmd('2026-09-01')).not.toBeNull()
  })

  it('accepts exactly the backend month pattern', () => {
    expect(isValidMonth('2026-10')).toBe(true)
    expect(isValidMonth('2026-13')).toBe(false)
    expect(isValidMonth('2026-1')).toBe(false)
    expect(isValidMonth(null)).toBe(false)
  })
})

describe('defaultWorkmonth', () => {
  it('is the current month on any day but the 1st', () => {
    expect(defaultWorkmonth('2026-10-06')).toBe('2026-10')
    expect(defaultWorkmonth('2026-10-31')).toBe('2026-10')
    expect(defaultWorkmonth('2026-10-02')).toBe('2026-10')
  })

  it('is the previous month on the 1st (the current window is still empty)', () => {
    expect(defaultWorkmonth('2026-10-01')).toBe('2026-09')
    expect(defaultWorkmonth('2026-03-01')).toBe('2026-02')
  })

  it('rolls 1 January back to December of the previous year', () => {
    expect(defaultWorkmonth('2027-01-01')).toBe('2026-12')
  })
})
