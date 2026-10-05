import { describe, expect, it } from 'vitest'
import en from '@/../public/locales/en/auth.json'
import es from '@/../public/locales/es/auth.json'
import uk from '@/../public/locales/uk/auth.json'

/**
 * Every `appLogin.*` key the phone-binding UI asks the `auth` namespace for
 * exists in all three languages. The shared `pages.*` guard covers the
 * `common` keys of the admin view; this one covers the profile section.
 */
const SOURCES = import.meta.glob('../**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

function usedKeys(): string[] {
  const keys = new Set<string>()
  for (const [path, source] of Object.entries(SOURCES)) {
    if (path.includes('__tests__')) continue
    for (const match of source.matchAll(/(?<![A-Za-z0-9_])t\(\s*'(appLogin\.[A-Za-z0-9_.]+)'/g)) {
      keys.add(match[1])
    }
  }
  return [...keys]
}

function lookup(dictionary: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>((node, part) => {
    if (node && typeof node === 'object' && part in node) {
      return (node as Record<string, unknown>)[part]
    }
    return undefined
  }, dictionary)
}

describe('app-login translation keys', () => {
  const keys = usedKeys()

  it('are collected from the source', () => {
    expect(keys.length).toBeGreaterThan(30)
  })

  it.each([
    ['en', en],
    ['uk', uk],
    ['es', es],
  ])('all exist in %s', (_language, dictionary) => {
    expect(keys.filter((key) => typeof lookup(dictionary, key) !== 'string')).toEqual([])
  })

  it('the Ukrainian section details say the bound phone skips only the IP restriction', () => {
    expect(lookup(uk, 'appLogin.section.details')).toMatch(/IP-адрес/)
    expect(lookup(uk, 'appLogin.section.title')).toBe('Вхід через мобільний застосунок')
  })
})
