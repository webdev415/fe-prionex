/**
 * Shared colour-ramp helpers for report tables.
 *
 * The red → yellow → green ramp started in the processing report
 * («Красный - жёлтый - зелёный (0% - 100%)», mirroring the Techno-Finance
 * reference) and is now used by several report tables over different scales,
 * so it lives here rather than inside one feature: a pure util must not drag a
 * feature's module graph (and its import cycles) into every consumer.
 *
 * Inputs are guarded defensively: a null/undefined/NaN value coming from a
 * backend payload must degrade to a neutral fill, never crash a table or
 * produce a literal "NaN" in a style attribute.
 */

/**
 * Map a value to a soft pastel HSL colour on a red → yellow → green gradient
 * over `[min .. max]` (min → red hue 0°, midpoint → yellow 60°, max → green
 * 120°). The pastel saturation/lightness (70%/85%) keeps dark text readable on
 * top. Out-of-range values are clamped; a non-finite value or a degenerate
 * scale (min === max) falls back to the midpoint yellow.
 */
export function gradientRedToGreen(value: number, min = 0, max = 100): string {
  const NEUTRAL = 'hsl(60, 70%, 85%)'
  if (typeof value !== 'number' || !Number.isFinite(value) || max === min) return NEUTRAL
  const normalized = Math.max(0, Math.min(1, (value - min) / (max - min)))
  const hue = normalized * 120
  return `hsl(${hue}, 70%, 85%)`
}
