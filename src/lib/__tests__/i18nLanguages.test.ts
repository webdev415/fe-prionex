import { describe, expect, it } from 'vitest'
import {
  LANGUAGE_FLAGS,
  LANGUAGE_NAMES,
  LANGUAGE_SHORT_NAMES,
  SUPPORTED_LANGUAGES,
  intlLocaleForUiLanguage,
  normalizeBackendLanguage,
} from '../i18n'

describe('Spanish as an interface language', () => {
  it('is offered next to English and Ukrainian', () => {
    expect(SUPPORTED_LANGUAGES).toEqual(['en', 'uk', 'es'])
  })

  it('has a name, short name and flag for every supported language', () => {
    for (const lang of SUPPORTED_LANGUAGES) {
      expect(LANGUAGE_NAMES[lang]).toBeTruthy()
      expect(LANGUAGE_SHORT_NAMES[lang]).toBeTruthy()
      expect(LANGUAGE_FLAGS[lang]).toBeTruthy()
    }
    expect(LANGUAGE_NAMES.es).toBe('Español')
  })

  it('keeps a Spanish preference stored on the account', () => {
    expect(normalizeBackendLanguage('es')).toBe('es')
    expect(normalizeBackendLanguage('es-ES')).toBe('es')
    expect(normalizeBackendLanguage('ES')).toBe('es')
  })

  it('maps the other stored languages as before', () => {
    expect(normalizeBackendLanguage('uk')).toBe('uk')
    expect(normalizeBackendLanguage('en')).toBe('en')
    expect(normalizeBackendLanguage('fr')).toBe('en')
    expect(normalizeBackendLanguage(null)).toBe('en')
  })

  it('formats Spanish with the es-ES locale', () => {
    expect(intlLocaleForUiLanguage('es')).toBe('es-ES')
    expect(intlLocaleForUiLanguage('uk')).toBe('uk-UA')
    expect(intlLocaleForUiLanguage('en')).toBe('en-US')
  })
})
