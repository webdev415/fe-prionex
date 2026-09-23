import { describe, expect, it } from 'vitest'
import enAuth from '@/../public/locales/en/auth.json'
import enCommon from '@/../public/locales/en/common.json'
import enErrors from '@/../public/locales/en/errors.json'
import enPayments from '@/../public/locales/en/payments.json'
import enPermissions from '@/../public/locales/en/permissions.json'
import esAuth from '@/../public/locales/es/auth.json'
import esCommon from '@/../public/locales/es/common.json'
import esErrors from '@/../public/locales/es/errors.json'
import esPayments from '@/../public/locales/es/payments.json'
import esPermissions from '@/../public/locales/es/permissions.json'

type Json = Record<string, unknown>

const NAMESPACES: Array<[string, Json, Json]> = [
  ['common', enCommon as Json, esCommon as Json],
  ['auth', enAuth as Json, esAuth as Json],
  ['errors', enErrors as Json, esErrors as Json],
  ['payments', enPayments as Json, esPayments as Json],
  ['permissions', enPermissions as Json, esPermissions as Json],
]

const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/
const PLACEHOLDER = /\{\{\s*([^}\s]+)\s*\}\}/g
const TAG = /<\/?\d+>/g

function flatten(obj: Json, prefix: string[] = [], out = new Map<string, unknown>()) {
  for (const [key, value] of Object.entries(obj)) {
    const path = [...prefix, key]
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      flatten(value as Json, path, out)
    } else {
      out.set(path.join(' › '), value)
    }
  }
  return out
}

function placeholdersOf(value: string): string[] {
  return [...value.matchAll(PLACEHOLDER)].map((match) => match[1]).sort()
}

function tagsOf(value: string): string[] {
  return (value.match(TAG) ?? []).sort()
}

describe.each(NAMESPACES)('Spanish %s translations', (_namespace, en, es) => {
  const enStrings = flatten(en)
  const esStrings = flatten(es)

  it('cover every English key', () => {
    const esBases = new Set([...esStrings.keys()].map((key) => key.replace(PLURAL_SUFFIX, '')))
    const missing = [...enStrings.keys()].filter(
      (key) => !esBases.has(key.replace(PLURAL_SUFFIX, ''))
    )

    expect(missing).toEqual([])
  })

  it('keep the same placeholders and tags as English', () => {
    const mismatched = [...enStrings].filter(([key, enValue]) => {
      const esValue = esStrings.get(key)
      if (typeof enValue !== 'string' || typeof esValue !== 'string') return false
      return (
        placeholdersOf(enValue).join() !== placeholdersOf(esValue).join() ||
        tagsOf(enValue).join() !== tagsOf(esValue).join()
      )
    })

    expect(mismatched.map(([key]) => key)).toEqual([])
  })

  it('leave nothing empty that English fills in', () => {
    const empty = [...enStrings].filter(([key, enValue]) => {
      const esValue = esStrings.get(key)
      return typeof enValue === 'string' && enValue.trim() !== '' && esValue === ''
    })

    expect(empty.map(([key]) => key)).toEqual([])
  })
})
