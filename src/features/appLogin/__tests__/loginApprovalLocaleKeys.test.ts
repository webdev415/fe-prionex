import { describe, expect, it } from 'vitest'
import en from '@/../public/locales/en/auth.json'
import es from '@/../public/locales/es/auth.json'
import uk from '@/../public/locales/uk/auth.json'

/**
 * The login screen asks the `auth` namespace for `appLogin.approval.*` from
 * outside this feature too (the TOTP card's «Підтвердити на телефоні»). The
 * feature's own guard scans only `features/appLogin`; this one covers the auth
 * cards and the login page, and pins the Ukrainian texts of the design (§12.1).
 */
const SOURCES = import.meta.glob(['/src/features/auth/components/*.tsx', '/src/pages/auth/*.tsx'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

function usedKeys(): string[] {
  const keys = new Set<string>()
  for (const source of Object.values(SOURCES)) {
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

function leaves(node: unknown, prefix = ''): string[] {
  if (typeof node === 'string') return [prefix]
  if (!node || typeof node !== 'object') return []
  return Object.entries(node).flatMap(([key, value]) =>
    leaves(value, prefix ? `${prefix}.${key}` : key)
  )
}

describe('login approval translation keys', () => {
  it('the auth cards use at least the TOTP card link', () => {
    expect(usedKeys()).toContain('appLogin.approval.useApp')
  })

  it.each([
    ['en', en],
    ['uk', uk],
    ['es', es],
  ])('all exist in %s', (_language, dictionary) => {
    expect(usedKeys().filter((key) => typeof lookup(dictionary, key) !== 'string')).toEqual([])
  })

  it('en, uk and es carry the same approval keys', () => {
    const reference = leaves(lookup(en, 'appLogin.approval')).sort()
    expect(reference.length).toBeGreaterThan(20)
    expect(leaves(lookup(uk, 'appLogin.approval')).sort()).toEqual(reference)
    expect(leaves(lookup(es, 'appLogin.approval')).sort()).toEqual(reference)
  })

  it('the Ukrainian texts are the design ones', () => {
    expect(lookup(uk, 'appLogin.approval.entry.button')).toBe(
      'Увійти через підтвердження в Prionex'
    )
    expect(lookup(uk, 'appLogin.approval.waiting.title')).toBe('Підтвердіть вхід на телефоні')
    expect(lookup(uk, 'appLogin.approval.waiting.instruction')).toBe(
      'Відкрийте Prionex Hub і введіть це число:'
    )
    expect(lookup(uk, 'appLogin.approval.outcome.denied')).toBe('Вхід відхилено на телефоні.')
    expect(lookup(uk, 'appLogin.approval.outcome.expired')).toBe('Час на підтвердження минув.')
    expect(lookup(uk, 'appLogin.approval.outcome.failed')).toBe(
      'Не вдалося підтвердити вхід. Увійдіть з паролем.'
    )
    expect(lookup(uk, 'appLogin.approval.useTotp')).toBe('Ввести код з Google Authenticator')
  })
})
