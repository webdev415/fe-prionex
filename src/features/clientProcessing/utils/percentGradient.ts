/**
 * Percent formatting and gradient helpers for the processing report table
 * (counts go through `formatNumber` from src/lib/localeFormat directly).
 *
 * The three "%" columns get a continuous red → yellow → green background over
 * the fixed 0–100 scale (spec: «Красный - жёлтый - зелёный (0% - 100%)»),
 * mirroring the Techno-Finance reference implementation; the ramp itself is the
 * shared `@/lib/gradient` one. Missing values stay uncoloured and render "—".
 *
 * All guards accept `unknown`-ish inputs defensively: a null/undefined/NaN
 * value from the backend must degrade to "—", never crash the tab or render
 * a literal "NaN".
 */

import { gradientRedToGreen } from '@/lib/gradient'
import { formatNumber } from '@/lib/localeFormat'

/**
 * The ramp itself now lives in `@/lib/gradient` (other report tables use it
 * over their own scales). Re-exported here so this module stays the single
 * import site for the processing table and its public barrel.
 */
export { gradientRedToGreen }

/** True when the value is a real, finite number (rejects null/undefined/NaN/Infinity). */
function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

/**
 * Format a 0..100 percent value as "XX.XX%" in the UI language's locale
 * (uk → «76,60%»); missing/non-finite values → "—".
 */
export function formatPercent(value: number | null | undefined, language: string): string {
  if (!isFiniteNumber(value)) return '—'
  return `${formatNumber(value, language, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`
}

/** Background colour for a percent cell; missing/non-finite cells get no fill. */
export function percentCellBackground(value: number | null | undefined): string | undefined {
  if (!isFiniteNumber(value)) return undefined
  return gradientRedToGreen(value)
}
