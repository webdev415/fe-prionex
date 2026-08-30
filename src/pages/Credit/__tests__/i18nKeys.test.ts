/**
 * Ни один ключ раздела не должен доехать до оператора машинным именем.
 *
 * Это уже второй такой дефект: сперва на экране висели `credit.card.passport`
 * и `credit.loanStatus.pending_disbursement`, потом — `credit.filters.dpdFrom`
 * над фильтром просрочки. Оба раза код просил строку, которой в словаре нет,
 * и оба раза это нашлось глазом на живом экране, а не проверкой.
 *
 * Тест читает ИСХОДНИКИ раздела, собирает статические ключи `t('credit.…')` и
 * требует их наличия в обоих словарях. Динамические (шаблонные) ключи вида
 * `t(`credit.bucket.${x}`)` он пропускает: их значения известны только в
 * рантайме — за них отвечают словари перечислений и проверка симметрии ниже.
 */
import { describe, it, expect } from 'vitest'
import en from '../../../../public/locales/en/common.json'
import uk from '../../../../public/locales/uk/common.json'
import { CREDIT_DYNAMIC_NAMESPACES } from '@/features/credit/api/enums'

// Исходники читаем глобом Vite, а не `node:fs`: сборка проекта идёт без типов
// Node, и `tsc -b` (то есть CI) на импорт `node:fs` падает.
const SOURCES = {
  ...import.meta.glob('../**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }),
  ...import.meta.glob('../../../features/credit/**/*.{ts,tsx}', {
    query: '?raw',
    import: 'default',
    eager: true,
  }),
} as Record<string, string>

function staticKeys(): Set<string> {
  const keys = new Set<string>()
  for (const [path, source] of Object.entries(SOURCES)) {
    if (path.includes('__tests__')) continue
    // Граница слова перед `t(` обязательна: без неё в выборку попадает хвост
    // любого имени, кончающегося на «t», — например `findByText('credit.…')`.
    for (const match of source.matchAll(/(?<![A-Za-z0-9_])t\(\s*'(credit\.[A-Za-z0-9_.]+)'/g)) {
      keys.add(match[1])
    }
  }
  return keys
}

function lookup(dictionary: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>((node, part) => {
    if (node && typeof node === 'object' && part in node) {
      return (node as Record<string, unknown>)[part]
    }
    return undefined
  }, dictionary)
}

describe('словари раздела «Кредитный модуль»', () => {
  it('содержат каждый статический ключ, который просит код', () => {
    const missing = { en: [] as string[], uk: [] as string[] }
    for (const key of staticKeys()) {
      if (typeof lookup(en, key) !== 'string') missing.en.push(key)
      if (typeof lookup(uk, key) !== 'string') missing.uk.push(key)
    }
    expect(missing).toEqual({ en: [], uk: [] })
  })

  it('покрывают динамические ключи ЦЕЛИКОМ по перечислениям контракта', () => {
    // Динамический ключ (`t(`credit.entryType.${entry.entry_type}`)`) статикой
    // не виден, и полноту нельзя мерить стендом: приёмка нашла шесть типов
    // проводок без строк — они рождаются командами кредита, а команды отвечают
    // 501. Оператор увидел бы машинные имена в журнале ровно в день, когда
    // команды заработают, и ни один прогон по стенду этого бы не поймал.
    const missing: Record<string, string[]> = {}
    for (const [namespace, values] of Object.entries(CREDIT_DYNAMIC_NAMESPACES)) {
      for (const value of values) {
        for (const [lang, dictionary] of [
          ['en', en],
          ['uk', uk],
        ] as const) {
          if (typeof lookup(dictionary, `credit.${namespace}.${value}`) !== 'string') {
            ;(missing[lang] ??= []).push(`credit.${namespace}.${value}`)
          }
        }
      }
    }
    expect(missing).toEqual({})
  })

  it('симметричны: ключ есть либо в обоих языках, либо ни в одном', () => {
    // Язык, где ключа нет, показывает оператору машинное имя — а заметят это
    // только украиноязычные операторы, то есть все, кто работает в проде.
    const flatten = (node: unknown, prefix = ''): string[] =>
      node && typeof node === 'object'
        ? Object.entries(node as Record<string, unknown>).flatMap(([key, value]) =>
            typeof value === 'string' ? [`${prefix}${key}`] : flatten(value, `${prefix}${key}.`)
          )
        : []
    const inEn = new Set(flatten((en as Record<string, unknown>).credit))
    const inUk = new Set(flatten((uk as Record<string, unknown>).credit))
    expect([...inEn].filter((key) => !inUk.has(key))).toEqual([])
    expect([...inUk].filter((key) => !inEn.has(key))).toEqual([])
  })
})
