import { describe, expect, it } from 'vitest'
import {
  displayFormatForLanguage,
  maskDateInput,
  maskDateTimeInput,
  parseManualDate,
  parseManualDateTime,
  pickerLocaleForLanguage,
} from '@/lib/dateUtils'

describe('date pickers in a Spanish interface', () => {
  it('shows any numeric day, month and year format as dd/MM/yyyy', () => {
    expect(displayFormatForLanguage('dd.MM.yyyy', 'es')).toBe('dd/MM/yyyy')
    expect(displayFormatForLanguage('dd-MM-yyyy', 'es')).toBe('dd/MM/yyyy')
    expect(displayFormatForLanguage('yyyy-MM-dd', 'es')).toBe('dd/MM/yyyy')
    expect(displayFormatForLanguage('MM/dd/yyyy', 'es')).toBe('dd/MM/yyyy')
    expect(displayFormatForLanguage('dd.MM.yyyy HH:mm', 'es')).toBe('dd/MM/yyyy HH:mm')
  })

  it('leaves month-name and year-only formats alone', () => {
    expect(displayFormatForLanguage('MMMM yyyy', 'es')).toBe('MMMM yyyy')
    expect(displayFormatForLanguage('yyyy', 'es')).toBe('yyyy')
  })

  it('keeps every format unchanged for Ukrainian and English', () => {
    expect(displayFormatForLanguage('dd.MM.yyyy', 'uk')).toBe('dd.MM.yyyy')
    expect(displayFormatForLanguage('yyyy-MM-dd', 'en')).toBe('yyyy-MM-dd')
  })

  it('uses the Spanish calendar only for Spanish', () => {
    expect(pickerLocaleForLanguage('es')?.code).toBe('es')
    expect(pickerLocaleForLanguage('uk')).toBeUndefined()
    expect(pickerLocaleForLanguage('en')).toBeUndefined()
  })

  it('masks typed dates with slashes', () => {
    expect(maskDateInput('1506', '/')).toBe('15/06')
    expect(maskDateInput('15062026', '/')).toBe('15/06/2026')
    expect(maskDateTimeInput('150620260900', '/')).toBe('15/06/2026 09:00')
  })

  it('parses complete dd/MM/yyyy entries and rejects impossible ones', () => {
    expect(parseManualDate('15/06/2026', 'dd/MM/yyyy')).toEqual(new Date(2026, 5, 15))
    expect(parseManualDate('31/02/2026', 'dd/MM/yyyy')).toBeNull()
    expect(parseManualDateTime('15/06/2026 09:00', 'dd/MM/yyyy HH:mm')).toEqual(
      new Date(2026, 5, 15, 9, 0)
    )
  })
})
