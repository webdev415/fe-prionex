import type { ReactNode } from 'react'
import { vi } from 'vitest'
import en from '@/../public/locales/en/common.json'

type Options = Record<string, unknown>

function lookup(key: string): unknown {
  return key.split('.').reduce<unknown>((node, part) => {
    if (node && typeof node === 'object' && part in node) {
      return (node as Record<string, unknown>)[part]
    }
    return undefined
  }, en)
}

function resolve(key: string, options: Options): string | undefined {
  if (typeof options.count === 'number') {
    const plural = lookup(`${key}_${options.count === 1 ? 'one' : 'other'}`)
    if (typeof plural === 'string') return plural
  }
  const value = lookup(key)
  return typeof value === 'string' ? value : undefined
}

export function translateEnglish(key: string, second?: unknown, third?: unknown): string {
  const options = ((second && typeof second === 'object' ? second : third) ?? {}) as Options
  const fallback =
    typeof second === 'string' ? second : (options.defaultValue as string | undefined)
  const template = resolve(key, options) ?? fallback ?? key
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, name: string) =>
    name in options ? String(options[name]) : match
  )
}

export function englishReactI18nextMock() {
  return {
    useTranslation: () => ({
      t: translateEnglish,
      i18n: { language: 'en', changeLanguage: vi.fn() },
    }),
    I18nextProvider: ({ children }: { children: ReactNode }) => children,
    initReactI18next: { type: '3rdParty', init: vi.fn() },
  }
}
