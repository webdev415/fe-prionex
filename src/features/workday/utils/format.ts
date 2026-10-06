/**
 * Value formatting for the workday / workmonth tabs and their modals.
 *
 * The backend sends WHOLE SECONDS and UTC instants; every unit conversion and
 * every clock reading happens here, once, so the tests can pin them.
 */

import { intlLocaleForUiLanguage } from '@/lib/i18n'
import { formatDate, formatNumber } from '@/lib/localeFormat'

/** Placeholder for a value the report has no answer for (shared table convention). */
export const EMPTY = '—'

/** The zone the report's calendar day is cut in (the contract's `timezone`). */
export const WORKDAY_TIMEZONE = 'Europe/Kyiv'

/** True for a real, finite number (rejects null/undefined/NaN/Infinity). */
export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

/**
 * Seconds → whole minutes, `Math.round(s / 60)` — the Techno-Finance rule
 * (`formatMinutes`), and the only rounding the frontend applies. Null for
 * anything that is not a finite number.
 */
export function secondsToMinutes(seconds: number | null | undefined): number | null {
  return isFiniteNumber(seconds) ? Math.round(seconds / 60) : null
}

/** A minutes column: whole minutes with locale grouping, «—» for no value. */
export function formatMinutes(seconds: number | null | undefined, language: string): string {
  const minutes = secondsToMinutes(seconds)
  return minutes === null ? EMPTY : formatNumber(minutes, language)
}

/** A plain count column (breaks, calls, days): locale grouping, «—» for no value. */
export function formatCount(value: number | null | undefined, language: string): string {
  return isFiniteNumber(value) ? formatNumber(value, language) : EMPTY
}

const ONE_DECIMAL: Intl.NumberFormatOptions = {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
}

/**
 * Working time in hours with ONE decimal (TF `formatHours`): minute-level
 * precision on a span of ~8 hours is noise. «—» for no value.
 */
export function formatHours(seconds: number | null | undefined, language: string): string {
  if (!isFiniteNumber(seconds)) return EMPTY
  return formatNumber(seconds / 3600, language, ONE_DECIMAL)
}

/**
 * A UTC instant as a 24 h `HH:mm` clock in `timeZone` (the answer's
 * `timezone`, i.e. Kyiv) — NOT in the browser's zone and NOT in the profile's:
 * the report's day is Kyiv's, and a «Старт дня 06:15» read in another zone
 * would contradict the day it belongs to. «—» for null or an unparseable
 * value. An unusable zone falls back to Kyiv rather than to the browser.
 */
export function formatClock(
  value: string | null | undefined,
  language: string,
  timeZone: string | null | undefined
): string {
  if (!value) return EMPTY
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return EMPTY
  const options: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }
  const locale = intlLocaleForUiLanguage(language)
  try {
    return new Intl.DateTimeFormat(locale, {
      ...options,
      timeZone: timeZone || WORKDAY_TIMEZONE,
    }).format(date)
  } catch {
    return new Intl.DateTimeFormat(locale, { ...options, timeZone: WORKDAY_TIMEZONE }).format(date)
  }
}

/**
 * A `YYYY-MM-DD` calendar day in the UI locale (uk → 17.09.2026).
 *
 * Built from the parts — `new Date('2026-09-17')` is UTC midnight and reads
 * as the previous day west of Greenwich.
 */
export function formatCalendarDay(ymd: string | null | undefined, language: string): string {
  const date = parseYmd(ymd)
  return date ? formatDate(date, language) : EMPTY
}

/** Short weekday name of a `YYYY-MM-DD` day in the UI locale (uk → «пт»). */
export function formatWeekdayShort(ymd: string, language: string): string {
  const date = parseYmd(ymd)
  if (!date) return EMPTY
  return new Intl.DateTimeFormat(intlLocaleForUiLanguage(language), { weekday: 'short' }).format(
    date
  )
}

/** A `YYYY-MM` month as «вересень 2026» in the UI locale. */
export function formatMonthLabel(month: string, language: string): string {
  const date = parseYmd(`${month}-01`)
  if (!date) return EMPTY
  return new Intl.DateTimeFormat(intlLocaleForUiLanguage(language), {
    month: 'long',
    year: 'numeric',
  }).format(date)
}

const YMD = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * A real calendar day from `YYYY-MM-DD` (local midnight), or null — also for
 * `2026-02-30`, which `new Date(y, m, d)` would silently roll into March.
 */
export function parseYmd(ymd: string | null | undefined): Date | null {
  const match = ymd ? YMD.exec(ymd) : null
  if (!match) return null
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? date
    : null
}

/**
 * The month tab's default for a Kyiv calendar day `YYYY-MM-DD`: the current
 * month, EXCEPT on the 1st — the current month's window is still empty then
 * (it ends yesterday), so the previous month is the useful default (owner
 * decision 06.10.2026). 1 January → December of the previous year.
 */
export function defaultWorkmonth(todayKyiv: string): string {
  const [year, month, day] = todayKyiv.split('-').map(Number)
  if (day !== 1) return todayKyiv.slice(0, 7)
  return month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, '0')}`
}

const YM = /^\d{4}-(0[1-9]|1[0-2])$/

/** The backend's own month pattern (`^\d{4}-(0[1-9]|1[0-2])$`, else 422). */
export function isValidMonth(month: string | null | undefined): month is string {
  return !!month && YM.test(month)
}
