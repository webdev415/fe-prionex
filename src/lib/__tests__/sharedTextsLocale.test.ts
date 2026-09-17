import { describe, expect, it } from 'vitest'
import en from '@/../public/locales/en/common.json'
import es from '@/../public/locales/es/common.json'
import uk from '@/../public/locales/uk/common.json'

type Json = Record<string, unknown>

function strings(obj: unknown, prefix = '', out = new Map<string, unknown>()) {
  for (const [key, value] of Object.entries(obj as Json)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (value && typeof value === 'object') strings(value, path, out)
    else out.set(path, value)
  }
  return out
}

describe.each(['toasts', 'components'])('%s texts', (section) => {
  const english = strings((en as Json)[section], section)

  it.each([
    ['uk', uk],
    ['es', es],
  ])('are all translated in %s', (_language, locale) => {
    const translated = strings((locale as Json)[section], section)

    expect([...translated.keys()].sort()).toEqual([...english.keys()].sort())
    const blank = [...translated].filter(([, value]) => typeof value !== 'string' || !value.trim())
    expect(blank).toEqual([])
  })
})
