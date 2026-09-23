import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import i18n from '@/lib/i18n'
import {
  convertUTCToUserTimezone,
  formatAuditLogTimestamp,
  formatDate,
  formatDateTime,
  formatIsoDate,
  formatMoneyKopeckTight,
  formatMoneyUAHTwoDecimals,
  formatNumber,
  formatPeriod,
  formatTaskDueDateForDisplay,
} from '@/lib/formatters'
import {
  dateTimeInputPattern,
  formatDate as formatLocaleDate,
  formatDateTime as formatLocaleDateTime,
  formatMoneyAmount,
} from '@/lib/localeFormat'

const mutableI18n = i18n as unknown as { language: string }

function usingLanguage(language: string) {
  beforeEach(() => {
    mutableI18n.language = language
  })
  afterEach(() => {
    mutableI18n.language = 'en'
  })
}

describe('formats for a Spanish interface', () => {
  usingLanguage('es')

  it('writes dates as dd/mm/yyyy', () => {
    expect(formatIsoDate('2026-07-05')).toBe('05/07/2026')
    expect(formatDate('2026-07-05')).toBe('05/07/2026')
    expect(formatPeriod('2026-07-01T12:00:00', '2026-07-05T12:00:00')).toBe(
      '01/07/2026 - 05/07/2026'
    )
  })

  it('writes date and time with a 24-hour clock', () => {
    expect(formatDateTime('2026-07-05T21:03:00Z', 'UTC')).toBe('05/07/2026 21:03')
    expect(formatTaskDueDateForDisplay('2026-07-05T21:03:00', 'UTC')).toBe('05/07/2026 21:03')
    expect(convertUTCToUserTimezone('2026-07-05T21:03:04', 'UTC')).toBe('05/07/2026 21:03:04')
  })

  it('groups thousands with a dot and uses a decimal comma', () => {
    expect(formatNumber(1234567)).toBe('1.234.567')
    expect(formatMoneyUAHTwoDecimals(12345.6)).toBe('₴ 12.345,60')
    expect(formatMoneyKopeckTight(5000)).toBe('₴5000,00')
  })

  it('shows the audit log day before a Spanish month name', () => {
    expect(formatAuditLogTimestamp('2026-07-05T21:03:04Z', 'UTC')).toBe('5 jul\n21:03:04')
  })

  it('formats language-aware helpers in es-ES', () => {
    expect(formatLocaleDate(new Date(2026, 6, 5), 'es')).toBe('05/07/2026')
    expect(formatLocaleDateTime(new Date(2026, 6, 5, 21, 3), 'es')).toBe('05/07/2026, 21:03')
    expect(formatMoneyAmount('12345.6', 'es')).toBe('12.345,60')
    expect(dateTimeInputPattern('es')).toBe('dd/MM/yyyy HH:mm')
  })
})

describe.each(['uk', 'en'])('formats for a %s interface stay unchanged', (language) => {
  usingLanguage(language)

  it('keeps dd-mm-yyyy dates and dot decimals', () => {
    expect(formatIsoDate('2026-07-05')).toBe('05-07-2026')
    expect(formatDateTime('2026-07-05T21:03:00Z', 'UTC')).toBe('05-07-2026 21:03')
    expect(convertUTCToUserTimezone('2026-07-05T21:03:04', 'UTC')).toBe('05-07-2026 21:03:04')
    expect(formatNumber(1234567)).toBe('1,234,567')
    expect(formatMoneyUAHTwoDecimals(12345.6)).toBe('₴ 12 345.60')
    expect(formatMoneyKopeckTight(5000)).toBe('₴5000.00')
    expect(formatAuditLogTimestamp('2026-07-05T21:03:04Z', 'UTC')).toBe('Jul 5\n21:03:04')
  })

  it('keeps the date-time input pattern', () => {
    expect(dateTimeInputPattern(language)).toBe(
      language === 'uk' ? 'dd.MM.yyyy HH:mm' : 'MM/dd/yyyy HH:mm'
    )
  })
})
