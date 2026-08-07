/**
 * Locale-aware date/number formatting keyed off the UI language.
 *
 * Every helper takes the UI `language` ('en' | 'uk') explicitly and maps it to
 * a BCP 47 locale via `intlLocaleForUiLanguage`, so output never depends on the
 * browser locale or the host machine. Components pass
 * `useTranslation().i18n.language`; lib adapters pass `i18n.language` from
 * `@/lib/i18n`.
 *
 * Import only the pure `intlLocaleForUiLanguage` here — the shared test setup
 * mocks i18next core, so `i18n.t`/`getFixedT` are unavailable in tests.
 */
import { intlLocaleForUiLanguage } from '@/lib/i18n'

type DateInput = string | number | Date

/** Shown when a date value cannot be parsed. */
const INVALID_PLACEHOLDER = '—'

function toValidDate(value: DateInput): Date | null {
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

// Intl.NumberFormat construction is comparatively expensive and report
// tables format hundreds of values per render — cache instances per
// locale+options.
const numberFormatCache = new Map<string, Intl.NumberFormat>()

// Cache policy: distinct locale+options combos are few in practice. If some
// caller ever generates unbounded option variants, dropping the whole cache
// once is cheaper and simpler than LRU bookkeeping.
const NUMBER_FORMAT_CACHE_MAX = 64

/**
 * Cached Intl.NumberFormat per locale+options (exported for callers needing
 * a raw formatter instance and for cache-behaviour tests).
 */
export function getNumberFormat(
  locale: string,
  opts?: Intl.NumberFormatOptions
): Intl.NumberFormat {
  // Key from sorted entries so option order doesn't split the cache
  // ({min,max} and {max,min} hit the same instance).
  const optsKey = opts
    ? JSON.stringify(Object.entries(opts).sort(([a], [b]) => a.localeCompare(b)))
    : ''
  const key = `${locale}|${optsKey}`
  let format = numberFormatCache.get(key)
  if (!format) {
    if (numberFormatCache.size >= NUMBER_FORMAT_CACHE_MAX) numberFormatCache.clear()
    format = new Intl.NumberFormat(locale, opts)
    numberFormatCache.set(key, format)
  }
  return format
}

/**
 * Number with locale grouping/decimals; pass `opts` for currency/precision.
 * Missing (null/undefined) or non-finite values render as "—", never "NaN".
 */
export function formatNumber(
  value: number | string | null | undefined,
  language: string,
  opts?: Intl.NumberFormatOptions
): string {
  const num = typeof value === 'string' ? Number(value) : value
  if (typeof num !== 'number' || !Number.isFinite(num)) return INVALID_PLACEHOLDER
  return getNumberFormat(intlLocaleForUiLanguage(language), opts).format(num)
}

/** Amount with fixed two decimals (no currency symbol — call-sites add ₴). */
export function formatMoneyAmount(value: number | string, language: string): string {
  return formatNumber(value, language, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/** Calendar date: en → MM/DD/YYYY, uk → DD.MM.YYYY. */
export function formatDate(value: DateInput, language: string): string {
  const date = toValidDate(value)
  if (!date) return INVALID_PLACEHOLDER
  return new Intl.DateTimeFormat(intlLocaleForUiLanguage(language), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

/** Calendar date + 24h time (HH:mm). */
export function formatDateTime(value: DateInput, language: string): string {
  const date = toValidDate(value)
  if (!date) return INVALID_PLACEHOLDER
  return new Intl.DateTimeFormat(intlLocaleForUiLanguage(language), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

/** Day + month only: en → MM/DD, uk → DD.MM. */
export function formatMonthDay(value: DateInput, language: string): string {
  const date = toValidDate(value)
  if (!date) return INVALID_PLACEHOLDER
  return new Intl.DateTimeFormat(intlLocaleForUiLanguage(language), {
    day: '2-digit',
    month: '2-digit',
  }).format(date)
}

/** 24h time only (HH:mm). */
export function formatTimeShort(value: DateInput, language: string): string {
  const date = toValidDate(value)
  if (!date) return INVALID_PLACEHOLDER
  return new Intl.DateTimeFormat(intlLocaleForUiLanguage(language), {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

/**
 * date-fns display pattern for a date+time `DateSelect` field, per UI language.
 * en → MM/dd/yyyy HH:mm, uk → dd.MM.yyyy HH:mm.
 */
export function dateTimeInputPattern(language: string): string {
  return intlLocaleForUiLanguage(language) === 'uk-UA' ? 'dd.MM.yyyy HH:mm' : 'MM/dd/yyyy HH:mm'
}
