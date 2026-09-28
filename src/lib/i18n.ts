import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import Backend from 'i18next-http-backend'

/** Cache-bust locale files on each new page load (dev) or build (prod). */
const BUILD_TIMESTAMP = import.meta.env.DEV
  ? String(Date.now())
  : (import.meta.env.VITE_BUILD_TS ?? '1')

export const SUPPORTED_LANGUAGES = ['en', 'uk', 'es'] as const
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]

export const LANGUAGE_NAMES: Record<SupportedLanguage, string> = {
  en: 'English',
  uk: 'Українська',
  es: 'Español',
}

export const LANGUAGE_SHORT_NAMES: Record<SupportedLanguage, string> = {
  en: 'EN',
  uk: 'UA',
  es: 'ES',
}

export const LANGUAGE_FLAGS: Record<SupportedLanguage, string> = {
  en: '🇬🇧',
  uk: '🇺🇦',
  es: '🇪🇸',
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

/**
 * Keep `<html lang>` in step with the active UI language. The static `lang="en"` in
 * index.html otherwise misreports Ukrainian content to screen readers and to the
 * browser's own hyphenation/spellcheck.
 */
function syncDocumentLang(lng: string): void {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = lng
  }
}
i18n.on('languageChanged', syncDocumentLang)
syncDocumentLang(i18n.language ?? 'en')

/**
 * Map API / legacy `language` to a supported UI code.
 * Legacy `ru` is mapped to `uk` so existing accounts keep a Cyrillic UI.
 */
export function normalizeBackendLanguage(lang: string | undefined | null): SupportedLanguage {
  const base = (lang ?? '').split('-')[0].toLowerCase()
  if (base === 'en') return 'en'
  if (base === 'uk') return 'uk'
  if (base === 'es') return 'es'
  if (base === 'ru') return 'uk'
  return 'en'
}

/** BCP 47 locale for `Intl`, dates, and numbers from UI language. */
export function intlLocaleForUiLanguage(lang: string | undefined | null): string {
  const base = (lang ?? 'en').split('-')[0]
  if (base === 'uk') return 'uk-UA'
  if (base === 'es') return 'es-ES'
  return 'en-US'
}

export function spanishLocaleOr(lang: string | undefined | null, locale: string): string {
  return normalizeBackendLanguage(lang) === 'es' ? 'es-ES' : locale
}

/** Apply server-stored language so UI matches the account after login/refresh (persists via i18n localStorage). */
export function applyPersistedLanguageFromServer(lang: string | undefined | null): void {
  void i18n.changeLanguage(normalizeBackendLanguage(lang))
}

export default i18n
