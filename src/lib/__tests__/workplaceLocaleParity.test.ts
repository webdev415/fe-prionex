import { describe, it, expect } from 'vitest'
import enCommon from '@/../public/locales/en/common.json'
import ukCommon from '@/../public/locales/uk/common.json'

type Json = Record<string, unknown>

const SUBTREES = ['pages.lawyerWorkplace.', 'pages.training.', 'pages.aiAssistant.'] as const

const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/

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

/** Plural forms differ per language (en: _one/_other, uk: _one/_few/_many), compare base keys. */
function normalizedKeys(obj: Json, subtree: string): Set<string> {
  return new Set(
    flattenKeys(obj)
      .filter((k) => k.startsWith(subtree))
      .map((k) => k.replace(PLURAL_SUFFIX, ''))
  )
}

describe.each(SUBTREES)('locale parity for %s', (subtree) => {
  it('every en key exists in uk', () => {
    const en = normalizedKeys(enCommon as Json, subtree)
    const uk = normalizedKeys(ukCommon as Json, subtree)
    const missing = [...en].filter((k) => !uk.has(k))
    expect(missing).toEqual([])
  })

  it('every uk key exists in en', () => {
    const en = normalizedKeys(enCommon as Json, subtree)
    const uk = normalizedKeys(ukCommon as Json, subtree)
    const extra = [...uk].filter((k) => !en.has(k))
    expect(extra).toEqual([])
  })
})
