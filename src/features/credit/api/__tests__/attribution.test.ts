/**
 * Метки заявки (18-13c): правила показа и параметры фильтров — без экрана.
 *
 * Пустота метки у модуля одна — `null`, но стенд старше 18-13 поля не шлёт, а
 * сайт до правила хранения мог прислать пустую строку или буквальный
 * `(not set)`. Маркетолог обязан видеть одно и то же `(not set)` во всех этих
 * случаях: иначе «пусто» и «(not set)» читаются как два разных источника.
 */
import { describe, it, expect, vi } from 'vitest'
import {
  ATTRIBUTION_FILTER_MAX,
  ATTRIBUTION_MASKED,
  ATTRIBUTION_NOT_SET,
  ATTRIBUTION_ROWS,
  attributionFilters,
  attributionValue,
  hasClickIdFrom,
  isAttributionSet,
  normalizeAttributionFilter,
  otherAttributionTags,
  truncateAttribution,
} from '../attribution'
import type { CreditApplicationMarketing } from '../types'

const EMPTY: CreditApplicationMarketing = {
  utm_source: null,
  utm_medium: null,
  utm_campaign: null,
  utm_content: null,
  utm_term: null,
  gclid: null,
  click_id: null,
  consent_ads: null,
  click_at: null,
}

describe('метки: что считается «не задано»', () => {
  it('пустая строка буквальная и не переводится', () => {
    expect(ATTRIBUTION_NOT_SET).toBe('(not set)')
  })

  it.each([null, undefined, '', '   ', '(not set)', '(NOT SET)', ' (Not Set) ', 42])(
    '%j — не задано',
    (value) => {
      expect(isAttributionSet(value), `${JSON.stringify(value)} показан как метка`).toBe(false)
    }
  )

  it.each(['partner1', 'not set', '(not set)x'])('%j — метка', (value) => {
    // Положительный контроль: правило не глотает похожие, но настоящие значения.
    expect(isAttributionSet(value)).toBe(true)
  })

  it('нет объекта меток (стенд до 18-13) — каждая строка не задана', () => {
    for (const key of ATTRIBUTION_ROWS) {
      expect(attributionValue(undefined, key), `${key} без marketing`).toBeNull()
      expect(attributionValue(null, key), `${key} при marketing = null`).toBeNull()
      expect(attributionValue(EMPTY, key), `${key} = null`).toBeNull()
    }
  })

  it('заданная метка возвращается как прислана, без обрезки', () => {
    const clickId = 'Ab'.repeat(200)
    const marketing = { ...EMPTY, utm_source: 'partner1', click_id: clickId }
    expect(attributionValue(marketing, 'utm_source')).toBe('partner1')
    // Укороченный click_id молча разошёлся бы с партнёрским — строка не режется.
    expect(attributionValue(marketing, 'click_id')).toBe(clickId)
  })
})

describe('метки: строки карточки', () => {
  it('девять строк в порядке ТЗ: семь меток, согласие, время клика', () => {
    expect([...ATTRIBUTION_ROWS]).toEqual([
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_content',
      'utm_term',
      'gclid',
      'click_id',
      'consent_ads',
      'click_at',
    ])
  })

  it('под маской записи сессии ровно клик-идентификаторы', () => {
    expect([...ATTRIBUTION_MASKED].sort()).toEqual(['click_id', 'gclid'])
    for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']) {
      expect(ATTRIBUTION_MASKED.has(key as never), `${key} под маской`).toBe(false)
    }
  })
})

describe('метки: прочие (marketing_other)', () => {
  it.each<Record<string, string> | null | undefined>([null, undefined, {}])(
    '%j — прочих нет',
    (other) => {
      expect(otherAttributionTags(other)).toEqual([])
    }
  )

  it('заданные — по алфавиту ключа, пустые отброшены', () => {
    expect(
      otherAttributionTags({ sub_id: 's1', fbclid: 'f1', empty: '', blank: ' ', ns: '(not set)' })
    ).toEqual([
      ['fbclid', 'f1'],
      ['sub_id', 's1'],
    ])
  })

  it('длинное значение — первые 256 знаков и многоточие', () => {
    const long = 'x'.repeat(300)
    expect(truncateAttribution(long)).toBe(`${'x'.repeat(256)}…`)
    // Граница: ровно 256 — без многоточия.
    expect(truncateAttribution('y'.repeat(256))).toBe('y'.repeat(256))
  })

  it('обрезка по графемам: эмодзи с ZWJ и буква с комбинируемым знаком на границе не рвутся', () => {
    const family = '\u{1F468}\u200D\u{1F469}\u200D\u{1F467}' // пять кодовых точек — одна графема
    const accent = 'é' // две кодовые точки — одна графема
    for (const glyph of [family, accent]) {
      const value = `${'a'.repeat(255)}${glyph}${'b'.repeat(50)}`
      expect(truncateAttribution(value), `${glyph} разорван на границе 256`).toBe(
        `${'a'.repeat(255)}${glyph}…`
      )
    }
    // Граница: ровно 256 графем (кодовых точек больше 256) — без многоточия.
    const exact = `${'a'.repeat(255)}${family}`
    expect(truncateAttribution(exact)).toBe(exact)
  })

  it('без Intl.Segmenter — по кодовым точкам, не по UTF-16: суррогатная пара целая', () => {
    vi.stubGlobal('Intl', {})
    try {
      const value = `${'a'.repeat(255)}😀${'b'.repeat(10)}`
      expect(truncateAttribution(value)).toBe(`${'a'.repeat(255)}😀…`)
    } finally {
      vi.unstubAllGlobals()
    }
    // Положительный контроль: глобал восстановлен, графемы снова считаются.
    expect('Segmenter' in Intl).toBe(true)
  })

  it('разбивка на графемы создаётся один раз, а не на каждую метку (хвост 18-13c-a)', () => {
    const Original = Intl.Segmenter
    let made = 0
    class Counting extends Original {
      constructor(...args: ConstructorParameters<typeof Intl.Segmenter>) {
        super(...args)
        made += 1
      }
    }
    const intl = Intl as unknown as { Segmenter: typeof Intl.Segmenter }
    intl.Segmenter = Counting
    try {
      const family = '\u{1F468}‍\u{1F469}‍\u{1F467}'
      for (let i = 0; i < 3; i += 1) {
        expect(truncateAttribution(`${'a'.repeat(255)}${family}bb`)).toBe(
          `${'a'.repeat(255)}${family}…`
        )
      }
    } finally {
      intl.Segmenter = Original
    }
    expect(made, 'Intl.Segmenter создаётся на каждый вызов').toBe(1)
  })
})

describe('метки: фильтры списка', () => {
  it('has_click_id из адреса — только true/false', () => {
    expect(hasClickIdFrom('true')).toBe(true)
    expect(hasClickIdFrom('false')).toBe(false)
    for (const junk of ['', 'TRUE', 'yes', '1']) {
      expect(hasClickIdFrom(junk), `«${junk}» стал фильтром`).toBeUndefined()
    }
  })

  it('текст обрезан, пустое не уходит, has_click_id — строкой', () => {
    expect(
      attributionFilters({
        utm_source: ' google ',
        utm_campaign: '',
        click_id: 'AbC',
        has_click_id: true,
      })
    ).toEqual({ utm_source: 'google', click_id: 'AbC', has_click_id: 'true' })
    expect(attributionFilters({ utm_campaign: '   ', has_click_id: false })).toEqual({
      has_click_id: 'false',
    })
  })

  it('предел модуля 512 кодовых точек после обрезки краёв: 512 уходит, 513 — фильтра нет', () => {
    expect(ATTRIBUTION_FILTER_MAX).toBe(512)
    const atLimit = 'x'.repeat(512)
    expect(attributionFilters({ click_id: `  ${atLimit} ` })).toEqual({ click_id: atLimit })
    expect(
      attributionFilters({ click_id: 'x'.repeat(513) }),
      '513 знаков ушли в запрос: модуль ответит 422'
    ).toEqual({})
    // Считаются кодовые точки, как у модуля, а не UTF-16: 512 эмодзи — 1024 единицы UTF-16.
    const emoji = '😀'.repeat(512)
    expect(attributionFilters({ utm_source: emoji })).toEqual({ utm_source: emoji })
    expect(attributionFilters({ utm_campaign: `${emoji}😀` })).toEqual({})
  })

  it.each([
    ['нет значения', undefined],
    ['пустое', ''],
    ['пробелы', '  \t '],
    ['513 знаков', 'x'.repeat(513)],
  ])('нормализация фильтра: %s — не задан', (_case, value) => {
    expect(normalizeAttributionFilter(value)).toBe('')
  })

  it('нормализация фильтра обрезает края и не трогает регистр', () => {
    expect(normalizeAttributionFilter('  AbC ')).toBe('AbC')
  })

  it('без меток — пустой объект: ни одного ключа', () => {
    expect(attributionFilters({})).toEqual({})
    expect(attributionFilters({ status: ['referred'], query: 'x' })).toEqual({})
  })
})
