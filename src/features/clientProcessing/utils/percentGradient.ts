/**
 * Percent formatting and gradient helpers for the processing report table
 * (counts go through `formatNumber` from src/lib/localeFormat directly).
 *
 * The three "%" columns get a continuous red → yellow → green background over
 * the fixed 0–100 scale (spec: «Красный - жёлтый - зелёный (0% - 100%)»),
 * mirroring the Techno-Finance reference implementation. Missing values stay
 * uncoloured and render "—".
 *
 * All guards accept `unknown`-ish inputs defensively: a null/undefined/NaN
 * value from the backend must degrade to "—", never crash the tab or render
 * a literal "NaN".
 */

import { formatNumber } from '@/lib/localeFormat'

/** True when the value is a real, finite number (rejects null/undefined/NaN/Infinity). */
function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

/**
 * Map a 0..100 percent value to a soft pastel HSL colour on a red → yellow →
 * green gradient (0 → red hue 0°, 50 → yellow 60°, 100 → green 120°).
 * The pastel saturation/lightness (70%/85%) keeps dark text readable on top.
 * Out-of-range values are clamped; NaN falls back to the midpoint yellow.
 */
export function gradientRedToGreen(value: number, min = 0, max = 100): string {
  const NEUTRAL = 'hsl(60, 70%, 85%)'
  if (!isFiniteNumber(value) || max === min) return NEUTRAL
  const normalized = Math.max(0, Math.min(1, (value - min) / (max - min)))
  const hue = normalized * 120
  return `hsl(${hue}, 70%, 85%)`
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
