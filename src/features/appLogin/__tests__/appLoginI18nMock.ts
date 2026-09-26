import { vi } from 'vitest'
import enAuth from '@/../public/locales/en/auth.json'
import enCommon from '@/../public/locales/en/common.json'

/**
 * A `react-i18next` stand-in that answers from the real English `auth` and
 * `common` files, so the app-login tests assert on the text a person reads
 * (with interpolated labels and dates) instead of on raw keys.
 */
function lookup(dictionary: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>((node, part) => {
    if (node && typeof node === 'object' && part in node) {
      return (node as Record<string, unknown>)[part]
    }
    return undefined
  }, dictionary)
}

export function translateAppLogin(key: string, second?: unknown, third?: unknown): string {
  const options = ((second && typeof second === 'object' ? second : third) ?? {}) as Record<
    string,
    unknown
  >
  const fallback = typeof second === 'string' ? second : undefined
  const found = [lookup(enAuth, key), lookup(enCommon, key)].find(
    (value): value is string => typeof value === 'string'
  )
  const template = found ?? fallback ?? key
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, name: string) =>
    name in options ? String(options[name]) : match
  )
}

export function appLoginI18nMock() {
  return {
    useTranslation: () => ({
      t: translateAppLogin,
      i18n: { language: 'en', changeLanguage: vi.fn() },
    }),
    I18nextProvider: ({ children }: { children: unknown }) => children,
    initReactI18next: { type: '3rdParty', init: vi.fn() },
  }
}
