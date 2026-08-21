/**
 * Error shaping for the Call QA rules editors.
 *
 * Two of quality-service's refusals are business rules the trainer must be
 * able to act on, not generic failures:
 *   - 409 on a blocker — the phrase already exists in that language;
 *   - 409 on a rubric — the (department, interlocutor) slice already has a
 *     live rubric, and the message names it.
 * Everything else collapses to the generic "could not save".
 */
import axios from 'axios'

export function isConflict(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 409
}

/** The server's `detail` string, when it sent a usable one. */
export function conflictDetail(error: unknown): string | undefined {
  if (!axios.isAxiosError(error)) return undefined
  const detail = (error.response?.data as { detail?: unknown } | undefined)?.detail
  return typeof detail === 'string' && detail.trim() ? detail : undefined
}
