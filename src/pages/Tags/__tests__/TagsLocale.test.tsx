import { describe, it, expect } from 'vitest'
import enCommon from '@/../public/locales/en/common.json'
import ukCommon from '@/../public/locales/uk/common.json'

type Json = Record<string, unknown>

function flattenKeys(obj: Json, prefix = ''): string[] {
  const keys: string[] = []
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      keys.push(...flattenKeys(value as Json, path))
    } else {
      keys.push(path)
    }
  }
  return keys
}

function tagKeys(obj: Json): string[] {
  return flattenKeys(obj).filter((k) => k.startsWith('pages.tags.'))
}

describe('Tags locale parity', () => {
  const enKeys = new Set(tagKeys(enCommon as Json))
  const ukKeys = new Set(tagKeys(ukCommon as Json))

  it('en/common.json contains pages.tags.* keys', () => {
    expect(enKeys.size).toBeGreaterThan(0)
  })

  it('uk has every pages.tags.* key from en', () => {
    const missingInUk = [...enKeys].filter((k) => !ukKeys.has(k))
    expect(missingInUk).toEqual([])
  })

  it('en has every pages.tags.* key from uk', () => {
    const missingInEn = [...ukKeys].filter((k) => !enKeys.has(k))
    expect(missingInEn).toEqual([])
  })

  it('no pages.tags.* value is an empty string', () => {
    const flat = (obj: Json): Record<string, unknown> => {
      const out: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(obj)) {
        if (v && typeof v === 'object' && !Array.isArray(v)) {
          for (const [k2, v2] of Object.entries(flat(v as Json))) {
            out[`${k}.${k2}`] = v2
          }
        } else {
          out[k] = v
        }
      }
      return out
    }
    const enFlat = flat(enCommon as Json)
    const ukFlat = flat(ukCommon as Json)
    const emptyEn = Object.entries(enFlat)
      .filter(([k, v]) => k.startsWith('pages.tags.') && typeof v === 'string' && v.trim() === '')
      .map(([k]) => k)
    const emptyUk = Object.entries(ukFlat)
      .filter(([k, v]) => k.startsWith('pages.tags.') && typeof v === 'string' && v.trim() === '')
      .map(([k]) => k)
    expect(emptyEn).toEqual([])
    expect(emptyUk).toEqual([])
  })
})
