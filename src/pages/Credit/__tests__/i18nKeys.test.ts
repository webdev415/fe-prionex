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
import es from '../../../../public/locales/es/common.json'
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

describe('этап заявки: значения ключей, а не только их наличие', () => {
  // Проверки живут здесь, а не в доменном тесте правила: этот файл уже читает
  // оба словаря, а `applicationStages.test.ts` иначе тянул бы два файла по
  // двенадцать тысяч строк и краснел на правках i18n, к правилу этапа
  // отношения не имеющих.
  const dictionaries = [
    ['uk', uk],
    ['en', en],
  ] as const

  it.each(dictionaries)('%s: прежнего ключа credit.stage.bank нет', (_lang, dictionary) => {
    // Страж симметрии проходит, пока ключ лежит в ОБОИХ языках, а страж
    // динамических ключей — пока в словаре есть всё, что в перечне. Оба
    // промолчали бы о забытом `bank`, оставленном рядом с `income_check`.
    expect(lookup(dictionary, 'credit.stage.bank')).toBeUndefined()
  })

  it.each(dictionaries)('%s: credit.stage.income_check — непустая строка', (_lang, dictionary) => {
    // Положительный контроль ТОГО ЖЕ поиска: иначе «не найдено» выше означало
    // бы «искать не умеем». Непустая, а не просто строка: `""` прошло бы
    // typeof-проверку и уехало на экран пустой подписью этапа.
    const value = lookup(dictionary, 'credit.stage.income_check')
    expect(typeof value).toBe('string')
    expect(String(value).trim()).not.toBe('')
  })

  it.each(dictionaries)(
    '%s: подпись шага несёт ОБА плейсхолдера, а не только текст',
    (_lang, dictionary) => {
      // Компонентный тест видит подпись через мок `t` и настоящий шаблон из
      // JSON не рендерит никогда. Потеря `{{index}}` при переводе оставалась бы
      // зелёной, а оператор прочёл бы «крок з 5».
      const value = lookup(dictionary, 'credit.card.stageOfTotal')
      expect(typeof value).toBe('string')
      expect(String(value)).toContain('{{index}}')
      expect(String(value)).toContain('{{total}}')
    }
  )
})

describe('разбор скоринга: подписи несут свои плейсхолдеры', () => {
  // Та же слепота, что у подписи шага: тест панели видит подписи через мок `t`,
  // настоящий шаблон из JSON не рендерит, и потерянный при переводе
  // плейсхолдер оставался бы зелёным. Оператор прочёл бы «2 з 7» с числом
  // бандов, вписанным в словарь, после калибровки книги — или «від» без числа.
  const dictionaries = [
    ['uk', uk],
    ['en', en],
    ['es', es],
  ] as const

  const PLACEHOLDERS: Array<[string, string[]]> = [
    ['bandValue', ['{{band}}', '{{bands}}']],
    ['totalValue', ['{{total}}', '{{max}}']],
    ['installmentsFrom', ['{{min}}']],
    ['installmentsUpTo', ['{{max}}']],
    ['installmentsRange', ['{{min}}', '{{max}}']],
  ]

  it.each(dictionaries)(
    '%s: credit.scorecard.* — каждый плейсхолдер на месте',
    (lang, dictionary) => {
      for (const [key, placeholders] of PLACEHOLDERS) {
        const value = lookup(dictionary, `credit.scorecard.${key}`)
        expect(typeof value, `${lang} credit.scorecard.${key} is not a string`).toBe('string')
        for (const placeholder of placeholders) {
          expect(String(value), `${lang} ${key} lost the ${placeholder} placeholder`).toContain(
            placeholder
          )
        }
      }
    }
  )
})

describe('19-5f: шаблоны чек-листа и условия несут свои плейсхолдеры', () => {
  // Та же слепота: мок `t` теста страницы печатает имена переменных из кода, а не
  // шаблон словаря, `spanishLocaleParity` сверяет только en и es. Потерянный в uk
  // плейсхолдер дал бы андеррайтеру «з {{applicable}}», а руководителю — диалог
  // подтверждения без суммы или без кодов.
  const dictionaries = [
    ['uk', uk],
    ['en', en],
    ['es', es],
  ] as const

  const TEMPLATES: Array<[string, string[]]> = [
    ['checklist.progress', ['{{answered}}', '{{total}}']],
    ['checklist.share', ['{{yes}}', '{{applicable}}']],
    ['card.proposedAmount', ['{{amount}}']],
    ['card.confirmMessage', ['{{amount}}', '{{codes}}']],
  ]

  it.each(dictionaries)(
    '%s: 19-5f — плейсхолдеры чек-листа и условия на месте',
    (lang, dictionary) => {
      for (const [key, placeholders] of TEMPLATES) {
        const value = lookup(dictionary, `credit.${key}`)
        expect(typeof value, `${lang} credit.${key} is not a string`).toBe('string')
        for (const placeholder of placeholders) {
          expect(String(value), `${lang} ${key} lost the ${placeholder} placeholder`).toContain(
            placeholder
          )
        }
      }
    }
  )
})
