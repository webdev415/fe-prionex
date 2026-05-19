import type { Section, ScoresPayload } from '../types'

/**
 * Frontend mirror of the backend's `compute_weighted_score` helper
 * (api-prionex/services/quality/app/services/scoring.py).
 *
 * Lets the side panel render a live preview as the trainer fills in scores
 * without an extra round trip. The backend recomputes authoritatively on
 * the `draft -> completed` transition; this preview is display-only.
 */
export function computeWeightedScorePreview(
  sections: Section[],
  scores: ScoresPayload
): number | null {
  let weightedSum = 0
  let totalWeight = 0

  for (const section of sections) {
    for (const criterion of section.criteria) {
      const entry = scores[criterion.key]
      if (!entry) continue
      const raw = entry.value
      if (raw == null) continue

      let numeric: number
      if (criterion.scale === 'binary') {
        numeric = raw ? 5 : 0
      } else {
        if (typeof raw !== 'number') continue
        numeric = Math.max(0, Math.min(5, raw))
      }

      const weight = Number(criterion.weight) || 0
      if (weight <= 0) continue
      weightedSum += numeric * weight
      totalWeight += weight
    }
  }

  if (totalWeight === 0) return null
  return Math.round((weightedSum / totalWeight) * 100) / 100
}
