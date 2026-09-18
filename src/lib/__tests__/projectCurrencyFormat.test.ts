import { afterEach, describe, expect, it } from 'vitest'
import i18n from '@/lib/i18n'
import { formatCurrency } from '@/lib/formatters'

const mutableI18n = i18n as unknown as { language: string }

function plainSpaces(text: string): string {
  return text.replace(/\s/g, ' ')
}

describe('formatCurrency with a project currency', () => {
  afterEach(() => {
    mutableI18n.language = 'en'
  })

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
