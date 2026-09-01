/**
 * Trainer-vs-AI score divergence — the one place the dispute rules live.
 *
 * A "dispute" is not a workflow: it is simply the trainer's own scorecard
 * carrying a `dispute_reason`. This module owns the two decisions the UI makes
 * around that:
 *
 *  1. how far apart the two scores are (the badge), and
 *  2. whether the divergence is big enough to ask the trainer why (the field).
 *
 * The threshold is **served by the backend** on the scorecard
 * (`dispute_reason_threshold`); the constant below is only a fallback for
 * responses that predate the field. Callers must go through
 * `resolveDisputeThreshold` rather than reaching for the constant, so the
 * number is never duplicated across components.
 */

/** Fallback threshold when the backend response carries none. */
export const DEFAULT_DISPUTE_THRESHOLD = 10

/**
 * Scale bridge. The trainer's `weighted_score` is persisted on the backend's
 * 0-5 criterion axis (`scoring.py`), while the AI snapshot mirrors
 * `call_ai_reviews.weighted_score`, which is already 0-100. Everything below —
 * and every consumer — works on the 0-100 display axis, so the ×20 lives here
 * exactly once.
 *
 * The API also serves the converted value as `trainer_score_100`; this stays
 * because the editor needs a score for what the trainer is typing *now*, and
 * the server's number necessarily lags the unsaved draft.
 */
export const TRAINER_SCORE_TO_100 = 20

/** Trainer `weighted_score` (0-5 axis) → the 0-100 display axis. */
export function trainerScoreTo100(weightedScore: number | null | undefined): number | null {
  if (weightedScore == null || !Number.isFinite(weightedScore)) return null
  return weightedScore * TRAINER_SCORE_TO_100
}

/** Source of the threshold — any object the API may hand us (or nothing). */
export interface DisputeThresholdSource {
  dispute_threshold?: number | null
}

/**
 * The active threshold, in 0-100 points.
 *
 * Only a finite, non-negative number from the backend wins; anything else
 * (missing field, null, NaN, a negative) falls back to the default, because a
 * bad threshold must not make the reason field appear on every scorecard.
 */
export function resolveDisputeThreshold(source?: DisputeThresholdSource | null): number {
  const fromApi = source?.dispute_threshold
  if (typeof fromApi === 'number' && Number.isFinite(fromApi) && fromApi >= 0) {
    return fromApi
  }
  return DEFAULT_DISPUTE_THRESHOLD
}

/**
 * Signed gap between the two scores, on the 0-100 axis: positive when the
 * trainer scored the call higher than the AI did.
 *
 * `null` when either side is missing — no AI snapshot, or no trainer score yet
 * (a draft carries none). There is nothing to compare, and the UI must show
 * nothing rather than imply a zero.
 */
export function scoreDivergence(
  aiScore100: number | null | undefined,
  trainerScore100: number | null | undefined
): number | null {
  if (aiScore100 == null || !Number.isFinite(aiScore100)) return null
  if (trainerScore100 == null || !Number.isFinite(trainerScore100)) return null
  return trainerScore100 - aiScore100
}

/**
 * Whether to ask the trainer why they disagree.
 *
 * True once the two scores exist and are at least `threshold` apart — the
 * boundary counts, matching the backend's `abs(score_delta) >= threshold`.
 * Below it, this is ordinary rounding between two readers of the same
 * checklist and the field would only be in the way. Direction is irrelevant:
 * scoring the call far lower than the AI is as much an objection as scoring
 * it far higher.
 */
export function isDisputeReasonRequested(
  aiScore100: number | null | undefined,
  trainerScore100: number | null | undefined,
  threshold: number
): boolean {
  const delta = scoreDivergence(aiScore100, trainerScore100)
  if (delta == null) return false
  return Math.abs(delta) >= threshold
}
