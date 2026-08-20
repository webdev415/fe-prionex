/**
 * Чистые кирпичики памяти ассистента: заголовок из текста, подпись
 * происхождения, толерантный разбор списка и классификация отказов.
 *
 * Всё это — места, где контракт бэкенда встречается с UI: неизвестный `source`,
 * голый массив вместо конверта и 409/422 с текстом сервера обязаны иметь
 * предсказуемый исход, а не «как повезёт».
 */
import { describe, expect, it } from 'vitest'

import { classifyMemoryError, normalizeMemoryList } from '../api'
import {
  makeMemoryTitle,
  memorySourceKey,
  shouldShowMemoryTitle,
  MEMORY_TITLE_LENGTH,
  formatMemoryDate,
} from '../memoryPresentation'

describe('makeMemoryTitle', () => {
  it('keeps a short fact as it stands', () => {
    expect(makeMemoryTitle('  Веду портфель Alfa  ')).toBe('Веду портфель Alfa')
  })

  it('collapses whitespace instead of dragging line breaks into the title', () => {
    expect(makeMemoryTitle('Клиент\n\nплатит  по вторникам')).toBe('Клиент платит по вторникам')
  })

  it('cuts a long fact on a word boundary', () => {
    const content =
      'Клиент Петров платит по вторникам после обеда и просит звонить только на мобильный'
    const title = makeMemoryTitle(content)

    expect(title.length).toBeLessThanOrEqual(MEMORY_TITLE_LENGTH + 1)
    expect(title.endsWith('…')).toBe(true)
    expect(title).not.toContain('  ')
    expect(content.startsWith(title.slice(0, -1))).toBe(true)
  })

  it('cuts hard when a single word exceeds the limit', () => {
    const title = makeMemoryTitle('А'.repeat(120))
    expect(title).toBe(`${'А'.repeat(MEMORY_TITLE_LENGTH)}…`)
  })
})

describe('shouldShowMemoryTitle', () => {
  it('прячет машинный заголовок наблюдения профайлера', () => {
    expect(
      shouldShowMemoryTitle(
        'Профиль оператора: Предпочитаемый формат…',
        'Предпочитаемый формат: количественные выборки.',
        'observation'
      )
    ).toBe(false)
  })

  it('прячет обрезанную копию текста (заголовок из первых символов)', () => {
    const content = 'Веду портфель Alfa, суммы пишу без копеек и всегда с валютой.'
    expect(
      shouldShowMemoryTitle('Веду портфель Alfa, суммы пишу без копеек…', content, 'user')
    ).toBe(false)
    expect(
      shouldShowMemoryTitle('Веду портфель Alfa, суммы пишу без копеек...', content, 'user')
    ).toBe(false)
  })

  it('показывает заголовок, который несёт своё содержание', () => {
    expect(shouldShowMemoryTitle('Формат отчётов', 'Суммы пишу без копеек.', 'user')).toBe(true)
  })

  it('пустой заголовок и точная копия текста не показываются', () => {
    expect(shouldShowMemoryTitle('', 'текст', 'user')).toBe(false)
    expect(shouldShowMemoryTitle('текст', 'текст', 'user')).toBe(false)
  })
})

describe('memorySourceKey', () => {
  it('maps the documented sources', () => {
    expect(memorySourceKey('user')).toBe('user')
    expect(memorySourceKey('agent')).toBe('agent')
    expect(memorySourceKey('seed')).toBe('observation')
    expect(memorySourceKey('profile')).toBe('observation')
    expect(memorySourceKey('profiler')).toBe('observation')
  })

  it('falls back to a neutral badge for a source the brain invented later', () => {
    expect(memorySourceKey('call_qa')).toBe('unknown')
    // kind важнее source: наблюдение профайлера остаётся наблюдением
    expect(memorySourceKey('call_qa', 'profile')).toBe('observation')
    expect(memorySourceKey('')).toBe('unknown')
  })
})

describe('normalizeMemoryList', () => {
  const item = {
    id: 1,
    kind: 'note',
    title: null,
    content: 'Факт',
    source: 'user',
    created_at: '2026-08-01T10:00:00Z',
  }

  it('reads the documented envelope', () => {
    expect(normalizeMemoryList({ items: [item], total: 7 })).toEqual({ items: [item], total: 7 })
  })

  it('accepts a bare array and counts it', () => {
    expect(normalizeMemoryList([item])).toEqual({ items: [item], total: 1 })
  })

  it('never yields a non-array items field', () => {
    expect(normalizeMemoryList(null)).toEqual({ items: [], total: 0 })
    expect(normalizeMemoryList({})).toEqual({ items: [], total: 0 })
    expect(normalizeMemoryList({ items: 'nope' })).toEqual({ items: [], total: 0 })
  })

  it('derives total when the server omits it', () => {
    expect(normalizeMemoryList({ items: [item] })).toEqual({ items: [item], total: 1 })
  })
})

describe('classifyMemoryError', () => {
  it('tells a duplicate from a validation refusal and keeps the server wording', () => {
    expect(
      classifyMemoryError({ response: { status: 409, data: { detail: 'Такий факт уже є' } } })
    ).toEqual({ kind: 'duplicate', message: 'Такий факт уже є' })

    expect(
      classifyMemoryError({
        response: { status: 422, data: { detail: [{ msg: 'Приберіть номер телефону' }] } },
      })
    ).toEqual({ kind: 'validation', message: 'Приберіть номер телефону' })
  })

  it('classifies a 403 and anything unexpected without leaking backend prose', () => {
    expect(
      classifyMemoryError({ response: { status: 403, data: { detail: 'no rights' } } })
    ).toEqual({ kind: 'forbidden' })
    expect(classifyMemoryError(new Error('network'))).toEqual({ kind: 'unknown' })
  })
})

describe('formatMemoryDate', () => {
  it('renders a date and swallows garbage', () => {
    expect(formatMemoryDate('2026-08-05T09:00:00Z', 'uk')).not.toBe('')
    expect(formatMemoryDate('not-a-date', 'uk')).toBe('')
    expect(formatMemoryDate(null, 'uk')).toBe('')
  })
})
