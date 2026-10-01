import { describe, expect, it } from 'vitest'
import en from '@/../public/locales/en/common.json'
import es from '@/../public/locales/es/common.json'
import uk from '@/../public/locales/uk/common.json'

/** Every key the template contract-type field and the generation reason read. */
const KEYS = [
  'saleType.label',
  'saleType.values.factoring',
  'saleType.values.cession',
  'pages.documentGeneration.templates.saleTypes.all',
  'pages.documentGeneration.templates.form.saleTypeHelp',
  'pages.clients.detail.generateModal.reasons.sale_type_mismatch',
]

function lookup(dictionary: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>((node, part) => {
    if (node && typeof node === 'object' && part in node) {
      return (node as Record<string, unknown>)[part]
    }
    return undefined
  }, dictionary)
}

describe('template contract-type translations', () => {
  it.each([
    ['en', en],
    ['uk', uk],
    ['es', es],
  ])('are non-empty strings in %s', (_language, dictionary) => {
    const missing = KEYS.filter((key) => {
      const value = lookup(dictionary, key)
      return typeof value !== 'string' || value.trim() === ''
    })
    expect(missing).toEqual([])
  })
})
