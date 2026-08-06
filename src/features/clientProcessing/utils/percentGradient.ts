/**
 * Percent formatting and gradient helpers for the processing report table.
 *
 * The three "%" columns get a continuous red → yellow → green background over
 * the fixed 0–100 scale (spec: «Красный - жёлтый - зелёный (0% - 100%)»),
 * mirroring the Techno-Finance reference implementation. Null cells stay
 * uncoloured and render "—".
 */

/**
 * Map a 0..100 percent value to a soft pastel HSL colour on a red → yellow →
 * green gradient (0 → red hue 0°, 50 → yellow 60°, 100 → green 120°).
 * The pastel saturation/lightness (70%/85%) keeps dark text readable on top.
 * Out-of-range values are clamped; NaN falls back to the midpoint yellow.
 */
export function gradientRedToGreen(value: number, min = 0, max = 100): string {
  const NEUTRAL = 'hsl(60, 70%, 85%)'
  if (Number.isNaN(value) || max === min) return NEUTRAL
  const normalized = Math.max(0, Math.min(1, (value - min) / (max - min)))
  const hue = normalized * 120
  return `hsl(${hue}, 70%, 85%)`
}

/** Format a 0..100 percent value as "XX.XX%"; null/NaN → "—". */
export function formatPercent(value: number | null): string {
  if (value === null || Number.isNaN(value)) return '—'
  return `${value.toFixed(2)}%`
}

/** Background colour for a percent cell; null/NaN cells get no fill. */
export function percentCellBackground(value: number | null): string | undefined {
  if (value === null || Number.isNaN(value)) return undefined
  return gradientRedToGreen(value)
}
