/**
 * Gradient bounds and value guards for the verification table.
 *
 * Colour rules follow the Techno-Finance reference (VerificationTable.tsx,
 * Card 128):
 *
 *   * «Верифіковано» — red → yellow → green fill over `[0 .. max(month_plan)]`
 *     (0 = red, the largest monthly plan = green);
 *   * «Унікальних клієнтів» — the same fill over the column's own
 *     `[min .. max]`;
 *   * «Недостача до плану» — NO fill, text colour only.
 *
 * The gradient function itself is reused from the processing report (via its
 * public index; it lives in `clientProcessing/utils/percentGradient`) — same
 * red→yellow→green pastel ramp, already covered by its own tests; a second
 * copy would be the kind of hand-rolled duplicate review rejects.
 *
 * Every input is guarded: `month_plan` arrives as a Decimal that may be
 * serialised as a JSON string, and any counter may be missing in a malformed
 * payload. A non-finite value must render "—" without a fill, never "NaN" and
 * never a crash.
 */

import { gradientRedToGreen } from '@/features/clientProcessing'

/**
 * Coerce a backend numeric (number, Decimal-as-string, null, undefined) to a
 * finite number, or `null` when it is not usable. Rejects empty/whitespace
 * strings, which `Number('')` would otherwise turn into 0.
 */
export function toFiniteNumber(value: number | string | null | undefined): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string') {
    if (value.trim() === '') return null
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

export interface GradientBounds {
  /** Upper bound of the «Верифіковано» scale: the largest plan in the data set. */
  maxPlan: number
  minClients: number
  maxClients: number
}

interface BoundsInput {
  numbers_added: number
  unique_clients: number
  month_plan: number | string | null
}

/**
 * Gradient bounds for one data set. Non-finite values are skipped entirely, so
 * a single broken row cannot poison a whole column's scale. Reduced instead of
 * `Math.max(...arr)` — spreading an arbitrarily long row list can overflow the
 * argument limit.
 */
export function verificationGradientBounds(rows: readonly BoundsInput[]): GradientBounds {
  let maxPlan: number | null = null
  let minClients: number | null = null
  let maxClients: number | null = null

  for (const row of rows) {
    const plan = toFiniteNumber(row?.month_plan)
    if (plan !== null && (maxPlan === null || plan > maxPlan)) maxPlan = plan

    const clients = toFiniteNumber(row?.unique_clients)
    if (clients !== null) {
      if (minClients === null || clients < minClients) minClients = clients
      if (maxClients === null || clients > maxClients) maxClients = clients
    }
  }

  return {
    maxPlan: maxPlan ?? 0,
    minClients: minClients ?? 0,
    maxClients: maxClients ?? 0,
  }
}

/**
 * Background for a gradient cell; missing/non-finite values get no fill.
 * A degenerate scale (min === max, e.g. every operator on the same number, or
 * no plan at all) falls back to the neutral midpoint inside
 * `gradientRedToGreen` — a flat column carries no ranking information.
 */
export function verificationCellBackground(
  value: number | string | null | undefined,
  min: number,
  max: number
): string | undefined {
  const numeric = toFiniteNumber(value)
  if (numeric === null) return undefined
  return gradientRedToGreen(numeric, min, max)
}

/** Sign bucket of the plan shortfall; `null` when the value is unusable. */
export type PlanDiffTone = 'negative' | 'positive' | null

/**
 * Tone for «Недостача до плану»: negative (below plan) vs positive-or-zero
 * (on/above plan). Rendering maps this to a colour — see VerificationTable.
 */
export function planDiffTone(value: number | string | null | undefined): PlanDiffTone {
  const numeric = toFiniteNumber(value)
  if (numeric === null) return null
  return numeric < 0 ? 'negative' : 'positive'
}
