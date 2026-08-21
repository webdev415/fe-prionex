/**
 * Error shaping for the Call QA rules editors.
 *
 * Some of quality-service's refusals are business rules the trainer must be
 * able to act on, not generic failures:
 *   - 409 on a blocker — the phrase already exists in that language;
 *   - 409 on a rubric — the (department, interlocutor, line) slice already has
 *     a live rubric, and the message names it;
 *   - 422 on a grading scale — duplicate bands, a band out of range, or a
 *     scale pinned to the line its card excludes («would never apply»).
 * Everything else collapses to the generic "could not save".
 */
import axios from 'axios'

export function isConflict(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 409
}

/**
 * A validation refusal that names its own reason. The editor mirrors these
 * rules locally, so a 422 reaching here means the two drifted — relaying the
 * server's own words is then the only useful thing to say.
 */
export function isValidationError(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 422
}

/**
 * The server's `detail`, when it sent a usable one.
 *
 * FastAPI answers 422 with a LIST of `{loc, msg, type}` rather than a string,
 * so a reader that only accepts a string would drop exactly the message a
 * trainer needs. Both shapes are flattened here.
 */
export function conflictDetail(error: unknown): string | undefined {
  if (!axios.isAxiosError(error)) return undefined
  const detail = (error.response?.data as { detail?: unknown } | undefined)?.detail
  if (typeof detail === 'string') return detail.trim() || undefined
  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => (item as { msg?: unknown } | null)?.msg)
      .filter((msg): msg is string => typeof msg === 'string' && msg.trim().length > 0)
    return messages.length > 0 ? messages.join('; ') : undefined
  }
  return undefined
}
