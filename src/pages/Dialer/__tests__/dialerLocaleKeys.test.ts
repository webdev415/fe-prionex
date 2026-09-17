import { describe, expect, it } from 'vitest'
import en from '../../../../public/locales/en/common.json'
import es from '../../../../public/locales/es/common.json'
import uk from '../../../../public/locales/uk/common.json'

const SOURCES = {
  ...import.meta.glob('../**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }),
  ...import.meta.glob('../../../features/dialer/**/*.{ts,tsx}', {
    query: '?raw',
    import: 'default',
    eager: true,
  }),
} as Record<string, string>

function staticKeys(): string[] {
  const keys = new Set<string>()
  for (const [path, source] of Object.entries(SOURCES)) {
    if (path.includes('__tests__')) continue
    for (const match of source.matchAll(/(?<![A-Za-z0-9_])t\(\s*'(dialer\.[A-Za-z0-9_.]+)'/g)) {
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

describe('dialer translations', () => {
  it('finds the keys the dialer screens ask for', () => {
    expect(staticKeys().length).toBeGreaterThan(30)
  })

  it.each([
    ['en', en],
    ['uk', uk],
    ['es', es],
  ])('contain every static dialer key in %s', (_language, dictionary) => {
    const missing = staticKeys().filter((key) => typeof lookup(dictionary, key) !== 'string')

    expect(missing).toEqual([])
  })
})
