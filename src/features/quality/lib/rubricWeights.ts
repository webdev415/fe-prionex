/**
 * Weight arithmetic for AI rubrics (`purpose='ai'` scorecard templates).
 *
 * quality-service rejects an AI rubric whose criteria weights don't add up
 * to exactly 100 (the boевой `rubric.json` the brain scores against is built
 * the same way). The editor mirrors that rule locally so the trainer sees
 * the running total instead of discovering it in a 422.
 */
import type { Section } from '../types'

export const RUBRIC_TOTAL_WEIGHT = 100

/** Same slack quality-service's validator allows. */
export const RUBRIC_WEIGHT_TOLERANCE = 0.01

/** Sum of every criterion weight across every section. Non-numeric → 0. */
export function sumCriteriaWeights(sections: Section[]): number {
  let total = 0
  for (const section of sections) {
    for (const criterion of section.criteria ?? []) {
      const weight = Number(criterion.weight)
      if (Number.isFinite(weight)) total += weight
    }
  }
  // Weights are entered as integers, but a float creeping in through the API
  // must not make the comparison flaky.
  return Math.round(total * 100) / 100
}

/**
 * Sum of one section's criterion weights. Shown on the collapsed section
 * header so a trainer can see how the 100 points are split between sections
 * without opening each one.
 */
export function sumSectionWeights(section: Section): number {
  return sumCriteriaWeights([section])
}

export function isRubricWeightValid(sections: Section[]): boolean {
  // An empty rubric sums to 0, which is not "valid but unfinished" — the
  // caller checks for criteria separately; here 0 simply isn't 100.
  return Math.abs(sumCriteriaWeights(sections) - RUBRIC_TOTAL_WEIGHT) <= RUBRIC_WEIGHT_TOLERANCE
}

/** A key unique inside `taken`, derived from a human label where possible. */
export function makeUniqueKey(label: string, taken: Set<string>, fallback: string): string {
  const base =
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40) || fallback
  if (!taken.has(base)) return base
  let n = 2
  while (taken.has(`${base}_${n}`)) n += 1
  return `${base}_${n}`
}
