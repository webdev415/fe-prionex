/**
 * Value formatting for the «Вихідні дзвінки» table, kept out of the component
 * so the clock rendering can be pinned by tests on its own.
 */

import { formatNumber } from '@/lib/localeFormat'

/** Placeholder for a value the report has no answer for (shared table convention). */
export const EMPTY = '—'

/** Percent columns arrive on the 0..100 scale, rounded to 2 decimals server-side. */
const TWO_DECIMALS: Intl.NumberFormatOptions = {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}

/** True for a real, finite number (rejects null/undefined/NaN/Infinity). */
function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

const pad = (n: number) => String(n).padStart(2, '0')

/**
 * A duration in whole seconds as HH:MM:SS.
 *
 * The HOURS field is not capped at 24 and is not padded beyond two digits:
 * "25:41:07" is a correct reading of a 25-hour sum. That is the whole reason
 * the backend sends seconds — the source Metabase card cast its sums to
 * `time`, which wraps modulo a day and showed 19 of 101 operators a small
 * random time on a quarter-wide window. Any `Date`-based rendering
 * (`toISOString().slice(11, 19)` and friends) would reintroduce exactly that
 * wrap, so the arithmetic is done here.
 *
 * A null value is a genuine "no answer" — the averages are null when their
 * denominator is zero — and renders "—", not "00:00:00". So does anything that
 * is not a finite non-negative number: a negative duration is not a value this
 * report has, and "NaN:NaN:NaN" must never reach the screen.
 */
export function formatDurationHms(seconds: number | null | undefined): string {
  if (!isFiniteNumber(seconds) || seconds < 0) return EMPTY
  const whole = Math.floor(seconds)
  const hours = Math.floor(whole / 3600)
  const minutes = Math.floor((whole % 3600) / 60)
  return `${pad(hours)}:${pad(minutes)}:${pad(whole % 60)}`
}

/**
 * A percent column (already 0..100 from the backend): two decimals in the UI
 * language's locale (uk → «25,69%»), matching the sibling report tabs.
 * Missing/non-finite values render "—".
 */
export function formatPercent(value: number | null | undefined, language: string): string {
  if (!isFiniteNumber(value)) return EMPTY
  return `${formatNumber(value, language, TWO_DECIMALS)}%`
}

/** A plain count column (calls dialled, connected, quality): locale grouping, no decimals. */
export function formatCount(value: number | null | undefined, language: string): string {
  return formatNumber(value, language)
}

/**
 * What the operator column shows.
 *
 * A seat the directory does not know carries no `fio`, and the row STAYS —
 * dropping it would quietly shrink every total against the telephony system.
 * The extension is then the only name the report has for it, so it stands in
 * (repeated in the SIP column, which is the honest reading: this row is a
 * seat, not a person). "—" would hide which seat the calls came from.
 */
export function operatorLabel(fio: string | null | undefined, sip: string): string {
  // Blank counts as missing, not as a name: `fio` is concatenated from the
  // directory's name parts, so a directory entry with nothing usable in them
  // yields whitespace rather than null, and `?? sip` alone would render an
  // empty cell.
  return fio && fio.trim() ? fio : sip
}

/**
 * What an org column (department, group) shows.
 *
 * Blank counts as missing for the same reason `operatorLabel` trims: these
 * values come out of the same directory, where an unfilled entry yields
 * whitespace rather than null, and `?? EMPTY` alone would render an empty cell
 * instead of the table's "—".
 */
export function orgLabel(value: string | null | undefined): string {
  return value && value.trim() ? value : EMPTY
}
