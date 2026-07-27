import { describe, expect, it } from 'vitest'
import {
  dateTimeInputPattern,
  formatDate,
  formatDateTime,
  formatMoneyAmount,
  formatMonthDay,
  formatNumber,
  formatTimeShort,
} from '../localeFormat'

// Local-component construction keeps browser-TZ formatting deterministic
// regardless of the host machine timezone.
const SAMPLE = new Date(2026, 6, 5, 9, 3, 0) // 2026-07-05 09:03 local

const DATETIME_OPTS: Intl.DateTimeFormatOptions = {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
}

describe('localeFormat', () => {
  describe('formatNumber / formatMoneyAmount', () => {
    it('en-US: comma grouping, dot decimals', () => {
      expect(formatMoneyAmount('12345.6', 'en')).toBe('12,345.60')
      expect(formatNumber(2500, 'en')).toBe('2,500')
      expect(formatNumber('1234567', 'en')).toBe('1,234,567')
    })

    it('uk-UA: matches the same-locale Intl output (ICU-version safe)', () => {
      const expectedMoney = Number('12345.6').toLocaleString('uk-UA', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
      expect(formatMoneyAmount('12345.6', 'uk')).toBe(expectedMoney)
      // Grouping separator is a (non-breaking) space, decimal is a comma.
      expect(formatMoneyAmount('12345.6', 'uk')).toMatch(/^12\s345,60$/)
    })

    it('unknown language falls back to en-US', () => {
      expect(formatMoneyAmount('12345.6', 'xx')).toBe('12,345.60')
    })
  })

  describe('formatDate', () => {
    it('en → MM/DD/YYYY, uk → DD.MM.YYYY', () => {
      expect(formatDate(SAMPLE, 'en')).toBe('07/05/2026')
      expect(formatDate(SAMPLE, 'uk')).toBe('05.07.2026')
    })

    it('accepts ISO strings and numbers', () => {
      expect(formatDate('2026-07-05T09:03:00', 'en')).toBe('07/05/2026')
      expect(formatDate(SAMPLE.getTime(), 'en')).toBe('07/05/2026')
    })

    it('invalid input → em dash', () => {
      expect(formatDate('not-a-date', 'en')).toBe('—')
      expect(formatDate('', 'uk')).toBe('—')
    })
  })

  describe('formatMonthDay', () => {
    it('en → MM/DD, uk → DD.MM', () => {
      expect(formatMonthDay(SAMPLE, 'en')).toBe('07/05')
      expect(formatMonthDay(SAMPLE, 'uk')).toBe('05.07')
    })
  })

  describe('formatTimeShort', () => {
    it('24h HH:mm in both locales', () => {
      expect(formatTimeShort(SAMPLE, 'en')).toBe('09:03')
      expect(formatTimeShort(SAMPLE, 'uk')).toBe('09:03')
    })
  })

  describe('formatDateTime', () => {
    it('en/uk match the same-locale Intl output', () => {
      expect(formatDateTime(SAMPLE, 'en')).toBe(
        new Intl.DateTimeFormat('en-US', DATETIME_OPTS).format(SAMPLE)
      )
      expect(formatDateTime(SAMPLE, 'uk')).toBe(
        new Intl.DateTimeFormat('uk-UA', DATETIME_OPTS).format(SAMPLE)
      )
    })

    it('en contains a 4-digit year and 24h time', () => {
      expect(formatDateTime(SAMPLE, 'en')).toContain('2026')
      expect(formatDateTime(SAMPLE, 'en')).toContain('09:03')
    })

    it('invalid input → em dash', () => {
      expect(formatDateTime('nope', 'en')).toBe('—')
    })
  })

  describe('dateTimeInputPattern', () => {
    it('returns a date-fns pattern per language', () => {
      expect(dateTimeInputPattern('en')).toBe('MM/dd/yyyy HH:mm')
      expect(dateTimeInputPattern('uk')).toBe('dd.MM.yyyy HH:mm')
      expect(dateTimeInputPattern('xx')).toBe('MM/dd/yyyy HH:mm')
    })
  })
})
