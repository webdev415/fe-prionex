import type { ScorecardHistoryItem } from '../types'

/**
 * Which card on a call this trainer should open.
 *
 * A call carries one card per evaluator, so "the scorecard for this call" no
 * longer names a single thing: a trainer coaching an operator and quality
 * control scoring the same operator's calls each have their own. Opening the
 * newest card on the call hands whoever looks second their colleague's
 * assessment, which the API refuses to let them save (403) — and which, before
 * it refused, they silently overwrote.
 *
 * Returns null when this trainer has not scored the call, which is the signal
 * to start a fresh evaluation. Null while the viewer is still resolving is
 * safe too: creating is create-or-update keyed on (call, trainer), so a POST
 * lands on their own card either way.
 */
export function ownScorecardId(
  history: ScorecardHistoryItem[] | undefined,
  currentUserId: number | string | null | undefined
): number | null {
  if (!history?.length || currentUserId == null) return null
  const mine = Number(currentUserId)
  if (Number.isNaN(mine)) return null
  // The endpoint returns newest first, so the first match is this trainer's
  // most recent card.
  return history.find((item) => item.trainer_id === mine)?.id ?? null
}
