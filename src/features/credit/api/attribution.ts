/**
 * Рекламные метки заявки (18-13c): показ в карточке и фильтры списка.
 *
 * Метки хранит и отбирает модуль (контракт 0.1.44, `ApplicationMarketing` и
 * фильтры `listInternalApplications`); здесь — только правила показа и
 * сборка параметров запроса. Метки — чужой ввод: любой открывает сайт с любым
 * `?utm_…`, поэтому значения уходят на экран только текстом.
 */
import type { CreditApplicationMarketing, CreditApplicationsParams } from './types'

/**
 * Пустая метка — буквально, как в GA4, Google Ads и выгрузке: маркетолог
 * сверяет строки один в один, поэтому не переводится.
 */
export const ATTRIBUTION_NOT_SET = '(not set)'

/** Семь меток ТЗ в порядке показа; подпись строки — само имя поля. */
export const ATTRIBUTION_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'gclid',
  'click_id',
] as const

/** Девять строк карточки: семь меток, затем согласие и время клика. */
export const ATTRIBUTION_ROWS = [...ATTRIBUTION_KEYS, 'consent_ads', 'click_at'] as const

export type CreditAttributionRow = (typeof ATTRIBUTION_ROWS)[number]

/**
 * Клик-идентификаторы — псевдонимные ключи, которыми сеть и партнёр связывают
 * человека со своим профилем: в записи сессии они под маской. UTM описывают
 * кампанию, а не человека, — открыты.
 */
export const ATTRIBUTION_MASKED: ReadonlySet<CreditAttributionRow> = new Set(['gclid', 'click_id'])

/** Предел показа прочей метки; полное значение в атрибут не кладётся. */
export const ATTRIBUTION_MAX_SHOWN = 256

/** Предел фильтра меток у модуля (`maxLength: 512`, кодовые точки): длиннее — ответ 422. */
export const ATTRIBUTION_FILTER_MAX = 512

/**
 * Задана ли метка. Пустая и пробельная строка и `(not set)` в любом регистре —
 * то же «метки нет», что и `null` (правило хранения модуля).
 */
export function isAttributionSet(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const trimmed = value.trim()
  return trimmed !== '' && trimmed.toLowerCase() !== ATTRIBUTION_NOT_SET
}

/** Значение строки карточки; `null` — показать `(not set)`. Нет `marketing` — стенд до 18-13. */
export function attributionValue(
  marketing: CreditApplicationMarketing | null | undefined,
  key: CreditAttributionRow
): string | null {
  const value: unknown = marketing?.[key]
  return isAttributionSet(value) ? value : null
}

/** Прочие метки (`marketing_other`): заданные, по алфавиту ключа. */
export function otherAttributionTags(
  other: Record<string, unknown> | null | undefined
): Array<[string, string]> {
  if (!other || typeof other !== 'object') return []
  return Object.entries(other)
    .filter((entry): entry is [string, string] => isAttributionSet(entry[1]))
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
}

/** Длинное значение — первые `max` графем (без `Intl.Segmenter` — кодовых точек) и `…`. */
export function truncateAttribution(value: string, max = ATTRIBUTION_MAX_SHOWN): string {
  const segmenter = 'Segmenter' in Intl && new Intl.Segmenter('und', { granularity: 'grapheme' })
  const chars = segmenter ? Array.from(segmenter.segment(value), (g) => g.segment) : [...value]
  return chars.length > max ? `${chars.slice(0, max).join('')}…` : value
}

/** `has_click_id` из адреса страницы: только `'true'`/`'false'`, прочее — фильтра нет. */
export function hasClickIdFrom(param: string): boolean | undefined {
  return param === 'true' ? true : param === 'false' ? false : undefined
}

/** Текстовый фильтр метки: края обрезаны; пустой или длиннее предела модуля — `''` (не задан). */
export function normalizeAttributionFilter(value: string | undefined): string {
  const trimmed = value?.trim() ?? ''
  return [...trimmed].length > ATTRIBUTION_FILTER_MAX ? '' : trimmed
}

/**
 * Фильтры меток для запроса — правилом «нет значения — нет ключа», как даты:
 * текст нормализован (`normalizeAttributionFilter`), пустой не уходит;
 * `has_click_id` — строкой `'true'|'false'` и только при выборе.
 */
export function attributionFilters(params: CreditApplicationsParams): Record<string, string> {
  const query: Record<string, string> = {}
  for (const key of ['utm_source', 'utm_campaign', 'click_id'] as const) {
    const value = normalizeAttributionFilter(params[key])
    if (value) query[key] = value
  }
  if (typeof params.has_click_id === 'boolean') query.has_click_id = String(params.has_click_id)
  return query
}
