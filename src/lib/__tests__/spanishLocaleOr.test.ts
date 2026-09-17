import { afterEach, describe, expect, it } from 'vitest'
import i18n, { spanishLocaleOr } from '@/lib/i18n'
import { dateSeparator } from '@/lib/formatters'

const mutableI18n = i18n as unknown as { language: string }

describe('spanishLocaleOr', () => {
  it('uses es-ES for a Spanish interface', () => {
    expect(spanishLocaleOr('es', 'uk-UA')).toBe('es-ES')
    expect(spanishLocaleOr('es-ES', 'en-GB')).toBe('es-ES')
  })

  it('keeps the given locale for every other interface', () => {
    expect(spanishLocaleOr('uk', 'uk-UA')).toBe('uk-UA')
    expect(spanishLocaleOr('en', 'en-GB')).toBe('en-GB')
    expect(spanishLocaleOr('en', 'uk-UA')).toBe('uk-UA')
    expect(spanishLocaleOr(undefined, 'en-US')).toBe('en-US')
  })
})

describe('dateSeparator', () => {
  afterEach(() => {
    mutableI18n.language = 'en'
  })

  it('uses a slash for a Spanish interface', () => {
    mutableI18n.language = 'es'
    expect(dateSeparator()).toBe('/')
  })

  it.each(['uk', 'en'])('keeps a dash for a %s interface', (language) => {
    mutableI18n.language = language
    expect(dateSeparator()).toBe('-')
  })
})
