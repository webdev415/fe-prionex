import { describe, expect, it } from 'vitest'
import en from '@/../public/locales/en/common.json'
import es from '@/../public/locales/es/common.json'
import uk from '@/../public/locales/uk/common.json'
import { EXIT_REASON_LABELS } from '../lib/exitReason'

type Json = Record<string, unknown>

const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/

function leafKeys(node: unknown, prefix = '', out = new Set<string>()): Set<string> {
  for (const [key, value] of Object.entries(node as Json)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (value && typeof value === 'object') leafKeys(value, path, out)
    else out.add(path.replace(PLURAL_SUFFIX, ''))
  }
  return out
}

function scoringV3(locale: unknown): Json {
  return ((locale as Json).pages as Json).scoringV3 as Json
}

describe('scoring v3 translations', () => {
  const english = leafKeys(scoringV3(en))

  it.each([
    ['uk', uk],
    ['es', es],
  ])('cover the same texts in %s as in English', (_language, locale) => {
    expect([...leafKeys(scoringV3(locale))].sort()).toEqual([...english].sort())
  })

  it('name every bucket and its meaning', () => {
    for (const bucket of ['CRIT', 'HIGH', 'AVG', 'LOW', 'EXIT']) {
      expect(english.has(`buckets.${bucket}`)).toBe(true)
      expect(english.has(`bucketMeaning.${bucket}`)).toBe(true)
    }
  })

  it('name every known exit reason', () => {
    for (const reason of [...Object.keys(EXIT_REASON_LABELS), 'unknown', 'other']) {
      expect(english.has(`exitReasons.${reason}`)).toBe(true)
    }
  })
})
