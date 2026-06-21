import { describe, expect, it } from 'vitest'
import { format } from 'date-fns'
import {
  applyDefaultTimeToDate,
  DATETIME_DISPLAY_FORMAT,
  maskDateTimeInput,
  parseManualDateTime,
} from '@/lib/dateUtils'

describe('applyDefaultTimeToDate — KAN-578 default-time split', () => {
  const hm = (d: Date) => `${d.getHours()}:${d.getMinutes()}`

  it('Case 2 — date first (day click, no value): seeds the default time', () => {
    const dayAtMidnight = new Date(2026, 5, 15, 0, 0, 0, 0)
    const out = applyDefaultTimeToDate(dayAtMidnight, {
      defaultTime: '09:00',
      hasExistingValue: false,
      fromDayClick: true,
    })
    expect(hm(out)).toBe('9:0')
    // does not mutate the input
    expect(hm(dayAtMidnight)).toBe('0:0')
  })

  it('Case 1 — time first (time click, no value): keeps the chosen time', () => {
    const todayAtChosenTime = new Date(2026, 5, 4, 14, 30, 0, 0)
    const out = applyDefaultTimeToDate(todayAtChosenTime, {
      defaultTime: '09:00',
      hasExistingValue: false,
      fromDayClick: false,
    })
    expect(hm(out)).toBe('14:30')
  })

  it('Case 1 edge — time first picking 00:00: keeps 00:00 (not overridden)', () => {
    const todayAtMidnight = new Date(2026, 5, 4, 0, 0, 0, 0)
    const out = applyDefaultTimeToDate(todayAtMidnight, {
      defaultTime: '09:00',
      hasExistingValue: false,
      fromDayClick: false,
    })
    expect(hm(out)).toBe('0:0')
  })

  it('later changes (value already set): never re-seeds, even on a day click', () => {
    const dayAtMidnight = new Date(2026, 5, 20, 0, 0, 0, 0)
    const out = applyDefaultTimeToDate(dayAtMidnight, {
      defaultTime: '09:00',
      hasExistingValue: true,
      fromDayClick: true,
    })
    expect(hm(out)).toBe('0:0')
  })

  it('no defaultTime configured: returns the date unchanged', () => {
    const d = new Date(2026, 5, 15, 0, 0, 0, 0)
    const out = applyDefaultTimeToDate(d, { hasExistingValue: false, fromDayClick: true })
    expect(hm(out)).toBe('0:0')
  })
})

describe('maskDateTimeInput', () => {
  it('auto-inserts separators progressively as digits are typed', () => {
    expect(maskDateTimeInput('1')).toBe('1')
    expect(maskDateTimeInput('15')).toBe('15')
    expect(maskDateTimeInput('1506')).toBe('15.06')
    expect(maskDateTimeInput('15062026')).toBe('15.06.2026')
    expect(maskDateTimeInput('1506202609')).toBe('15.06.2026 09')
    expect(maskDateTimeInput('150620260900')).toBe('15.06.2026 09:00')
  })

  it('ignores non-digit characters so pasting/backspacing re-masks cleanly', () => {
    expect(maskDateTimeInput('15.06.2026 09:00')).toBe('15.06.2026 09:00')
    expect(maskDateTimeInput('15/06/2026')).toBe('15.06.2026')
  })

  it('caps input at the 12 meaningful digits', () => {
    expect(maskDateTimeInput('1506202609009999')).toBe('15.06.2026 09:00')
  })

  it('pads an impossible first digit and auto-advances (9 -> 09)', () => {
    expect(maskDateTimeInput('9')).toBe('09') // day can't start with 9
    expect(maskDateTimeInput('99')).toBe('09.09') // day 09, month 09
    // The reported case: 90.90.9090 90:90 becomes all range-valid parts.
    expect(maskDateTimeInput('909090909090')).toBe('09.09.0909 09:09')
  })

  it('clamps completed two-digit parts to their maximum', () => {
    expect(maskDateTimeInput('35')).toBe('31') // day max 31
    expect(maskDateTimeInput('1513')).toBe('15.12') // month max 12
    expect(maskDateTimeInput('150620262500')).toBe('15.06.2026 23:00') // hour max 23
  })

  it('clamps day/month up to their minimum (00 -> 01)', () => {
    expect(maskDateTimeInput('00')).toBe('01') // day can't be 00
    expect(maskDateTimeInput('0000')).toBe('01.01') // day and month can't be 00
    // The reported case: 00.00.6202 00:06 — day/month corrected, midnight kept.
    expect(maskDateTimeInput('000062020006')).toBe('01.01.6202 00:06')
  })

  it('keeps 00 for hour and minute (midnight is valid)', () => {
    expect(maskDateTimeInput('150620260000')).toBe('15.06.2026 00:00')
  })

  it('leaves valid in-range values untouched', () => {
    expect(maskDateTimeInput('311220262359')).toBe('31.12.2026 23:59')
    expect(maskDateTimeInput('3')).toBe('3') // valid day start, keep as-is
    expect(maskDateTimeInput('30')).toBe('30')
  })
})

describe('parseManualDateTime', () => {
  it('parses a complete, valid value', () => {
    const d = parseManualDateTime('15.06.2026 09:00')
    expect(d).not.toBeNull()
    expect(format(d as Date, DATETIME_DISPLAY_FORMAT)).toBe('15.06.2026 09:00')
  })

  it('rejects incomplete input (date without time)', () => {
    expect(parseManualDateTime('15.06.2026')).toBeNull()
    expect(parseManualDateTime('15.06.2026 09')).toBeNull()
  })

  it('rejects impossible dates and times', () => {
    expect(parseManualDateTime('35.13.2026 09:00')).toBeNull()
    expect(parseManualDateTime('10.06.2026 25:00')).toBeNull()
    expect(parseManualDateTime('31.02.2026 09:00')).toBeNull()
  })

  it('rejects empty input', () => {
    expect(parseManualDateTime('')).toBeNull()
  })
})
