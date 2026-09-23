import { describe, expect, it } from 'vitest'
import en from '@/../public/locales/en/common.json'
import es from '@/../public/locales/es/common.json'
import uk from '@/../public/locales/uk/common.json'

const SOURCES = import.meta.glob('../../**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const PLURAL_FORMS = ['_one', '_other']

function staticKeys(): string[] {
  const keys = new Set<string>()
  for (const [path, source] of Object.entries(SOURCES)) {
    if (path.includes('__tests__') || /\.test\.tsx?$/.test(path)) continue
    for (const match of source.matchAll(/(?<![A-Za-z0-9_])t\(\s*'(pages\.[A-Za-z0-9_.]+)'/g)) {
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

function isTranslated(dictionary: unknown, key: string): boolean {
  if (typeof lookup(dictionary, key) === 'string') return true
  return PLURAL_FORMS.some((suffix) => typeof lookup(dictionary, `${key}${suffix}`) === 'string')
}

describe('static page translation keys', () => {
  const keys = staticKeys()

  it('are collected from the source', () => {
    expect(keys.length).toBeGreaterThan(1000)
  })

  it.each([
    ['en', en],
    ['uk', uk],
    ['es', es],
  ])('all exist in %s', (_language, dictionary) => {
    expect(keys.filter((key) => !isTranslated(dictionary, key))).toEqual([])
  })
})
