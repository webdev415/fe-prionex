import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import Backend from 'i18next-http-backend'

/** Cache-bust locale files on each new page load (dev) or build (prod). */
const BUILD_TIMESTAMP = import.meta.env.DEV
  ? String(Date.now())
  : (import.meta.env.VITE_BUILD_TS ?? '1')

export const SUPPORTED_LANGUAGES = ['en', 'uk'] as const
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]

export const LANGUAGE_NAMES: Record<SupportedLanguage, string> = {
  en: 'English',
  uk: 'Українська',
}

export const LANGUAGE_SHORT_NAMES: Record<SupportedLanguage, string> = {
  en: 'EN',
  uk: 'UA',
}

export const LANGUAGE_FLAGS: Record<SupportedLanguage, string> = {
  en: '🇬🇧',
  uk: '🇺🇦',
}

i18n
  .use(Backend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    supportedLngs: SUPPORTED_LANGUAGES,
    defaultNS: 'common',
    ns: ['common', 'auth', 'errors', 'payments'],

    interpolation: {
      escapeValue: false,
    },

    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },

    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
      queryStringParams: { v: BUILD_TIMESTAMP },
    },
  })

/** Map API `language` (uk|en|ru) to an i18n-supported UI code (ru → uk per product rules). */
export function normalizeBackendLanguage(lang: string | undefined | null): SupportedLanguage {
  if (lang === 'en' || lang === 'uk') return lang
  if (lang === 'ru') return 'uk'
  return 'en'
}

/** Apply server-stored language so UI matches the account after login/refresh (persists via i18n localStorage). */
export function applyPersistedLanguageFromServer(lang: string | undefined | null): void {
  void i18n.changeLanguage(normalizeBackendLanguage(lang))
}

export default i18n
