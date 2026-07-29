import { describe, expect, it } from 'vitest'
import { generateCode } from './utils'

describe('generateCode', () => {
  it("transliterates Ukrainian names to a latin slug (CEO's example)", () => {
    expect(generateCode('Офіційні листи НБУ')).toBe('ofitsiini_lysty_nbu')
  })

  it('applies Ukrainian romanization for special letters', () => {
    expect(generateCode('Європейський')).toBe('ievropeiskyi')
    expect(generateCode('Щомісячна заява')).toBe('shchomisiachna_zaiava')
    expect(generateCode('Хмельницький')).toBe('khmelnytskyi')
  })

  it('romanizes г as h and ґ as g (KMU №55)', () => {
    expect(generateCode('Готівка')).toBe('hotivka')
    expect(generateCode('Ґанок')).toBe('ganok')
  })

  it('drops brackets and punctuation, collapsing separators to a single underscore', () => {
    expect(generateCode('Спір (щодо) платежу!')).toBe('spir_shchodo_platezhu')
    expect(generateCode('  Тест   —  тест  ')).toBe('test_test')
  })

  it('lowercases and trims leading/trailing underscores', () => {
    expect(generateCode('__Payment Dispute__')).toBe('payment_dispute')
  })

  it('prepends a letter when the slug would start with a digit', () => {
    expect(generateCode('2024 звіт')).toBe('n2024_zvit')
    expect(generateCode('123')).toBe('n123')
  })

  it('always matches the backend id pattern or is empty', () => {
    const pattern = /^[a-z][a-z0-9_-]*$/
    for (const name of ['Офіційні листи НБУ', '2024 звіт', 'Тест', 'A-B c']) {
      const code = generateCode(name)
      expect(code === '' || pattern.test(code)).toBe(true)
    }
  })

  it('returns an empty string when there are no transliterable letters', () => {
    expect(generateCode('   ')).toBe('')
    expect(generateCode('!!!')).toBe('')
  })

  it('caps the slug at 50 characters', () => {
    expect(generateCode('a'.repeat(80)).length).toBe(50)
  })
})
