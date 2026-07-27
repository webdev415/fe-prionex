import { describe, expect, it } from 'vitest'
import {
  requiresDigitsOnly,
  hasNonDigitChars,
  isDuplicateContactValue,
} from './contactValueValidation'

describe('requiresDigitsOnly', () => {
  it('requires digits for Client and Recommender sources', () => {
    expect(requiresDigitsOnly('client')).toBe(true)
    expect(requiresDigitsOnly('recommender')).toBe(true)
  })

  it('does not restrict Other source or unknown sources', () => {
    expect(requiresDigitsOnly('other')).toBe(false)
    expect(requiresDigitsOnly(null)).toBe(false)
    expect(requiresDigitsOnly(undefined)).toBe(false)
  })
})

describe('hasNonDigitChars', () => {
  it('accepts pure digit strings', () => {
    expect(hasNonDigitChars('380970306248')).toBe(false)
  })

  it('ignores surrounding whitespace', () => {
    expect(hasNonDigitChars('  380970306248  ')).toBe(false)
  })

  it('flags letters and phone formatting characters', () => {
    expect(hasNonDigitChars('380abc')).toBe(true)
    expect(hasNonDigitChars('+380970306248')).toBe(true)
    expect(hasNonDigitChars('380 970 30 62')).toBe(true)
    expect(hasNonDigitChars('(097)-030')).toBe(true)
  })
})

describe('isDuplicateContactValue', () => {
  const contacts = [
    { id: 1, contactValue: '380970306248' },
    { id: 2, contactValue: 'Test@Example.com' },
    { id: 3, contactValue: '380501234567' },
  ]

  it('detects a duplicate across contact sources', () => {
    expect(isDuplicateContactValue(contacts, '380970306248', null)).toBe(true)
  })

  it('matches case-insensitively after trimming', () => {
    expect(isDuplicateContactValue(contacts, '  test@example.com ', null)).toBe(true)
  })

  it('excludes the contact being edited from the comparison', () => {
    expect(isDuplicateContactValue(contacts, '380970306248', 1)).toBe(false)
  })

  it('allows a brand-new value', () => {
    expect(isDuplicateContactValue(contacts, '380000000000', null)).toBe(false)
  })

  it('never treats a blank value as a duplicate', () => {
    expect(isDuplicateContactValue(contacts, '   ', null)).toBe(false)
  })
})
