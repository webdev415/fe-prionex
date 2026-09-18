import { afterEach, describe, expect, it } from 'vitest'
import i18n from '@/lib/i18n'
import {
  formatCurrency,
  formatMoneyKopeckTight,
  formatMoneyUAHTwoDecimals,
  withCurrency,
} from '@/lib/formatters'
import { setActiveCurrency } from '@/lib/projectCurrency'

const mutableI18n = i18n as unknown as { language: string }

function plainSpaces(text: string): string {
  return text.replace(/\s/g, ' ')
}

afterEach(() => {
  mutableI18n.language = 'en'
  setActiveCurrency('UAH')
})

describe('formatCurrency with a project currency', () => {
  it('writes euros the Spanish way', () => {
    mutableI18n.language = 'es'

    expect(plainSpaces(formatCurrency('12345.6', 'EUR'))).toBe('12.346 €')
  })

  it('writes euros the English way', () => {
    expect(formatCurrency(12345, 'EUR')).toBe('€12,345')
  })

  it('keeps hryvnia as before', () => {
    expect(formatCurrency(12345, 'UAH')).toBe('₴ 12 345')
    expect(formatCurrency(12345)).toBe('₴ 12 345')
    expect(formatCurrency(12345, null)).toBe('₴ 12 345')
  })

  it('shows a dash for a missing amount in any currency', () => {
    expect(formatCurrency(null, 'EUR')).toBe('—')
    expect(formatCurrency('abc', 'EUR')).toBe('—')
  })
})

describe('money in a euro project', () => {
  it('uses the active project currency when none is given', () => {
    setActiveCurrency('EUR')

    expect(formatCurrency(12345)).toBe('€12,345')
  })

  it('writes two-decimal amounts as 12.345,60 € for a Spanish operator', () => {
    setActiveCurrency('EUR')
    mutableI18n.language = 'es'

    expect(plainSpaces(formatMoneyUAHTwoDecimals('12345.6'))).toBe('12.345,60 €')
    expect(plainSpaces(formatMoneyUAHTwoDecimals(null))).toBe('0,00 €')
  })

  it('writes Ukrainian grouping for a Ukrainian operator', () => {
    setActiveCurrency('EUR')
    mutableI18n.language = 'uk'

    expect(plainSpaces(formatMoneyUAHTwoDecimals(12345.6))).toBe('12 345,60 €')
  })

  it('keeps the tight format without grouping', () => {
    setActiveCurrency('EUR')
    mutableI18n.language = 'es'

    expect(plainSpaces(formatMoneyKopeckTight(5000))).toBe('5000,00 €')
    expect(plainSpaces(formatMoneyKopeckTight(-5000))).toBe('-5000,00 €')
    expect(plainSpaces(formatMoneyKopeckTight(''))).toBe('0,00 €')
  })

  it('leaves hryvnia output unchanged', () => {
    expect(formatMoneyUAHTwoDecimals(12345.6)).toBe('₴ 12 345.60')
    expect(formatMoneyKopeckTight(5000)).toBe('₴5000.00')
  })
})

describe('withCurrency', () => {
  it('places the hryvnia sign the way each screen did', () => {
    expect(withCurrency('1 000')).toBe('₴ 1 000')
    expect(withCurrency('1 000', 'suffix')).toBe('1 000 ₴')
    expect(withCurrency('1 000', 'tight')).toBe('₴1 000')
  })

  it('puts the euro sign after the amount in Spanish and Ukrainian', () => {
    setActiveCurrency('EUR')
    mutableI18n.language = 'es'
    expect(withCurrency('1.000,50', 'tight')).toBe('1.000,50 €')

    mutableI18n.language = 'uk'
    expect(withCurrency('1 000,50')).toBe('1 000,50 €')
  })

  it('puts the euro sign first in English, after a minus', () => {
    setActiveCurrency('EUR')

    expect(withCurrency('1,000.50', 'suffix')).toBe('€1,000.50')
    expect(withCurrency('-5.00')).toBe('-€5.00')
  })

  it('follows an explicit currency over the active one', () => {
    expect(withCurrency('10', 'prefix', 'EUR')).toBe('€10')
  })
})
