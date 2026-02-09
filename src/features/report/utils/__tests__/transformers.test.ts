/**
 * Unit Tests for Data Transformers
 *
 * Tests transformation helper functions used across the report feature.
 */

import { describe, it, expect } from 'vitest'
import { mapPeriodToBackend, trendToChangeType, formatDuration, parseNumber } from '../transformers'

describe('mapPeriodToBackend', () => {
  it('should map "today" to "today"', () => {
    expect(mapPeriodToBackend('today')).toBe('today')
  })

  it('should map "thisWeek" to "this_week"', () => {
    expect(mapPeriodToBackend('thisWeek')).toBe('this_week')
  })

  it('should map "thisMonth" to "this_month"', () => {
    expect(mapPeriodToBackend('thisMonth')).toBe('this_month')
  })
})

describe('trendToChangeType', () => {
  it('should return "increase" for "up"', () => {
    expect(trendToChangeType('up')).toBe('increase')
  })

  it('should return "decrease" for "down"', () => {
    expect(trendToChangeType('down')).toBe('decrease')
  })

  it('should return "increase" for "stable"', () => {
    // Stable trends are treated as increase (no decrease indicator)
    expect(trendToChangeType('stable')).toBe('increase')
  })
})

describe('formatDuration', () => {
  it('should format 0 seconds as "00:00"', () => {
    expect(formatDuration(0)).toBe('00:00')
  })

  it('should format seconds only as "M:SS"', () => {
    expect(formatDuration(125)).toBe('2:05')
  })

  it('should format minutes and seconds as "M:SS"', () => {
    expect(formatDuration(65)).toBe('1:05')
  })

  it('should format hours, minutes, and seconds as "H:MM:SS"', () => {
    expect(formatDuration(3665)).toBe('1:01:05')
  })

  it('should handle negative numbers as 0', () => {
    expect(formatDuration(-10)).toBe('00:00')
  })

  it('should pad seconds correctly', () => {
    expect(formatDuration(5)).toBe('0:05')
    expect(formatDuration(65)).toBe('1:05')
    expect(formatDuration(3605)).toBe('1:00:05')
  })

  it('should handle large durations', () => {
    expect(formatDuration(7265)).toBe('2:01:05') // 2 hours, 1 min, 5 sec
  })
})

describe('parseNumber', () => {
  it('should parse string numbers', () => {
    expect(parseNumber('123')).toBe(123)
    expect(parseNumber('123.45')).toBe(123.45)
  })

  it('should return number as-is', () => {
    expect(parseNumber(123)).toBe(123)
    expect(parseNumber(123.45)).toBe(123.45)
  })

  it('should return 0 for empty string', () => {
    expect(parseNumber('')).toBe(0)
  })

  it('should return 0 for invalid string', () => {
    expect(parseNumber('invalid')).toBe(0)
  })

  it('should handle decimal strings', () => {
    expect(parseNumber('0.5')).toBe(0.5)
    expect(parseNumber('999.99')).toBe(999.99)
  })

  it('should handle negative numbers', () => {
    expect(parseNumber(-123)).toBe(-123)
    expect(parseNumber('-456')).toBe(-456)
  })
})
