/**
 * i18n namespace `planner` (planner story 1.9, AC6).
 *
 * A namespace needs three things or it silently no-ops: `en` JSON, `uk` JSON
 * and an entry in `ns` of `src/lib/i18n.ts`. `es` deliberately has no
 * `planner.json` and falls back to English (`fallbackLng: 'en'`, PRD A-104).
 */
import { describe, expect, it } from 'vitest'
import en from '@/../public/locales/en/planner.json'
import uk from '@/../public/locales/uk/planner.json'
import i18nSource from '../i18n.ts?raw'

type Json = Record<string, unknown>

const PLACEHOLDER = /\{\{\s*([^}\s]+)\s*\}\}/g

function flatten(obj: Json, prefix: string[] = [], out = new Map<string, unknown>()) {
  for (const [key, value] of Object.entries(obj)) {
    const path = [...prefix, key]
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      flatten(value as Json, path, out)
    } else {
      out.set(path.join('.'), value)
    }
  }
  return out
}

const placeholders = (value: unknown) =>
  typeof value === 'string' ? [...value.matchAll(PLACEHOLDER)].map((m) => m[1]).sort() : []

const LOCALE_FILES = import.meta.glob('../../../public/locales/*/planner.json')

describe('i18n namespace planner', () => {
  const enKeys = flatten(en as Json)
  const ukKeys = flatten(uk as Json)

  it('has the same keys in en and uk, both ways', () => {
    expect([...enKeys.keys()].filter((key) => !ukKeys.has(key))).toEqual([])
    expect([...ukKeys.keys()].filter((key) => !enKeys.has(key))).toEqual([])
  })

  it('keeps the same placeholders and leaves nothing empty', () => {
    const mismatched = [...enKeys].filter(
      ([key, value]) => placeholders(value).join() !== placeholders(ukKeys.get(key)).join()
    )
    expect(mismatched.map(([key]) => key)).toEqual([])
    const empty = [...enKeys, ...ukKeys].filter(([, value]) => value === '')
    expect(empty.map(([key]) => key)).toEqual([])
  })

  it('is registered in `ns`, and es has no planner.json (English fallback)', () => {
    const ns = i18nSource.match(/ns:\s*\[([^\]]*)\]/)
    expect(ns?.[1]).toContain("'planner'")
    expect(
      Object.keys(LOCALE_FILES)
        .map((path) => path.split('/').at(-2))
        .sort()
    ).toEqual(['en', 'uk'])
  })
})
