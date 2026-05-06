import { describe, it, expect } from 'vitest'
import enCommon from '@/../public/locales/en/common.json'
import ukCommon from '@/../public/locales/uk/common.json'
import ruCommon from '@/../public/locales/ru/common.json'
import { DEFAULT_AVAILABLE_EVENTS } from '@/stores/tagConfigStore'

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

function leafKeysUnder(obj: Json, prefix: string): string[] {
  return flattenKeys(obj).filter((k) => k.startsWith(prefix))
}

describe('Tags locale parity', () => {
  const enKeys = new Set(tagKeys(enCommon as Json))
  const ukKeys = new Set(tagKeys(ukCommon as Json))
  const ruKeys = new Set(tagKeys(ruCommon as Json))

  it('every locale exposes pages.tags.* keys', () => {
    expect(enKeys.size).toBeGreaterThan(0)
    expect(ukKeys.size).toBeGreaterThan(0)
    expect(ruKeys.size).toBeGreaterThan(0)
  })

  it('all three locales agree on pages.tags.* key set', () => {
    const all = new Set<string>([...enKeys, ...ukKeys, ...ruKeys])
    const missing = {
      en: [...all].filter((k) => !enKeys.has(k)),
      uk: [...all].filter((k) => !ukKeys.has(k)),
      ru: [...all].filter((k) => !ruKeys.has(k)),
    }
    expect(missing).toEqual({ en: [], uk: [], ru: [] })
  })

  it('no pages.tags.* value is an empty string in any locale', () => {
    function emptyKeys(source: Json): string[] {
      const flat = flattenKeys(source)
      const out: string[] = []
      for (const path of flat) {
        if (!path.startsWith('pages.tags.')) continue
        const value = path.split('.').reduce<unknown>((acc, key) => {
          if (acc && typeof acc === 'object') {
            return (acc as Json)[key]
          }
          return undefined
        }, source)
        if (typeof value === 'string' && value.trim() === '') {
          out.push(path)
        }
      }
      return out
    }
    expect(emptyKeys(enCommon as Json)).toEqual([])
    expect(emptyKeys(ukCommon as Json)).toEqual([])
    expect(emptyKeys(ruCommon as Json)).toEqual([])
  })

  it('every DEFAULT_AVAILABLE_EVENTS field has pages.tags.rules.eventPayloadFields.<field> in ru/uk/en', () => {
    const fieldNames = new Set(
      DEFAULT_AVAILABLE_EVENTS.flatMap((event) => event.fields.map((f) => f.value))
    )
    const localeKeys = { ru: ruKeys, uk: ukKeys, en: enKeys }
    const missing: string[] = []
    for (const lang of ['ru', 'uk', 'en'] as const) {
      for (const fieldName of fieldNames) {
        const path = `pages.tags.rules.eventPayloadFields.${fieldName}`
        if (!localeKeys[lang].has(path)) {
          missing.push(`${lang}: ${fieldName}`)
        }
      }
    }
    expect(missing).toEqual([])
  })

  it('pages.tags.rules.eventOptions.* leaf keys agree across ru/uk/en', () => {
    const prefix = 'pages.tags.rules.eventOptions.'
    const enLeaves = new Set(leafKeysUnder(enCommon as Json, prefix))
    const ukLeaves = new Set(leafKeysUnder(ukCommon as Json, prefix))
    const ruLeaves = new Set(leafKeysUnder(ruCommon as Json, prefix))
    const all = new Set<string>([...enLeaves, ...ukLeaves, ...ruLeaves])
    const missing = {
      en: [...all].filter((k) => !enLeaves.has(k)),
      uk: [...all].filter((k) => !ukLeaves.has(k)),
      ru: [...all].filter((k) => !ruLeaves.has(k)),
    }
    expect(missing).toEqual({ en: [], uk: [], ru: [] })
  })

  it('interaction.created result_name values are not language-mixed (RU vs UK spot-check)', () => {
    const ruResults = (ruCommon as Json).pages as Json
    const uk = (ukCommon as Json).pages as Json
    const ruResultName = (
      (((ruResults.tags as Json).rules as Json).eventOptions as Json)['interaction.created'] as Json
    ).result_name as Record<string, string>
    const ukResultName = (
      (((uk.tags as Json).rules as Json).eventOptions as Json)['interaction.created'] as Json
    ).result_name as Record<string, string>

    expect(ruResultName['No contact']).toBe('Нет контакта')
    expect(ukResultName['No contact']).toBe('Немає контакту')
    expect(ruResultName['Agreement']).toBe('Обещание оплаты')
    expect(ukResultName['Agreement']).toBe('Обіцянка оплати')
    expect(ruResultName['Refusal to pay']).toBe('Отказ от оплаты')
    expect(ukResultName['Refusal to pay']).toBe('Відмова від оплати')
    expect(ruResultName['Hanged up']).toBe('Положил трубку')
    expect(ukResultName['Hanged up']).toBe('Поклав слухавку')
  })
})
