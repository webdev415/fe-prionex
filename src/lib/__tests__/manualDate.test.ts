import { describe, expect, it } from 'vitest'
import { format } from 'date-fns'
import { DATE_DISPLAY_FORMAT, maskDateInput, parseManualDate } from '@/lib/dateUtils'

describe('maskDateInput', () => {
  it('auto-inserts separators progressively as digits are typed', () => {
    expect(maskDateInput('1')).toBe('1')
    expect(maskDateInput('15')).toBe('15')
    expect(maskDateInput('1506')).toBe('15.06')
    expect(maskDateInput('15062026')).toBe('15.06.2026')
  })

  it('ignores non-digit characters so pasting/backspacing re-masks cleanly', () => {
    expect(maskDateInput('15.06.2026')).toBe('15.06.2026')
    expect(maskDateInput('15/06/2026')).toBe('15.06.2026')
  })

  it('caps input at 8 meaningful digits', () => {
    expect(maskDateInput('150620269999')).toBe('15.06.2026')
  })

  it('pads an impossible first digit and auto-advances (9 -> 09)', () => {
    expect(maskDateInput('9')).toBe('09')
    expect(maskDateInput('99')).toBe('09.09')
  })

  it('clamps completed two-digit day/month to their maximum', () => {
    expect(maskDateInput('35')).toBe('31')
    expect(maskDateInput('1513')).toBe('15.12')
  })

  it('clamps day/month up to their minimum (00 -> 01)', () => {
    expect(maskDateInput('00')).toBe('01')
    expect(maskDateInput('0000')).toBe('01.01')
  })

  it('leaves valid in-range values untouched', () => {
    expect(maskDateInput('31122026')).toBe('31.12.2026')
    expect(maskDateInput('3')).toBe('3')
    expect(maskDateInput('30')).toBe('30')
  })
})

describe('parseManualDate', () => {
  it('parses a complete, valid value', () => {
    const d = parseManualDate('15.06.2026')
    expect(d).not.toBeNull()
    expect(format(d as Date, DATE_DISPLAY_FORMAT)).toBe('15.06.2026')
  })

  it('rejects incomplete input', () => {
    expect(parseManualDate('01.06')).toBeNull()
    expect(parseManualDate('15.06.20')).toBeNull()
  })

  it('rejects impossible calendar dates', () => {
    expect(parseManualDate('31.02.2026')).toBeNull()
    expect(parseManualDate('35.13.2026')).toBeNull()
  })

  it('rejects empty input', () => {
    expect(parseManualDate('')).toBeNull()
  })
})
