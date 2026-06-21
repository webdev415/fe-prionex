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

  it('clamps completed two-digit day/month to their maximum', () => {
    expect(maskDateInput('35')).toBe('31')
    expect(maskDateInput('1513')).toBe('15.12')
  })

  it('rejects impossible calendar dates on parse', () => {
    expect(parseManualDate('31.02.2026')).toBeNull()
    expect(parseManualDate('01.06')).toBeNull()
  })

  it('parses a complete, valid value', () => {
    const d = parseManualDate('15.06.2026')
    expect(d).not.toBeNull()
    expect(format(d as Date, DATE_DISPLAY_FORMAT)).toBe('15.06.2026')
  })
})
