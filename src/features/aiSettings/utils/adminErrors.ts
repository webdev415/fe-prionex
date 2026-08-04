/**
 * Failure classification for the assistant admin writes.
 *
 * The three management endpoints answer with distinct, user-meaningful
 * statuses, and the UI must not collapse them into one "something went
 * wrong": a 422 carries text the admin has to read and act on, a 503 means
 * the brain is down and retrying now is pointless, a 404 means the skill
 * list on screen is stale.
 *
 * Only `validation` carries a server message. For the rest the caller picks
 * a localized string off `kind` — server prose for a 403/502 would leak
 * backend wording (and sometimes internals) into the UI for no benefit.
 */

export type AssistantAdminErrorKind =
  | 'validation'
  | 'forbidden'
  | 'notFound'
  | 'unavailable'
  | 'unknown'

export interface AssistantAdminError {
  kind: AssistantAdminErrorKind
  /** Server-supplied text, populated for `validation` only. */
  message?: string
}

function readStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object' || !('response' in error)) return undefined
  const status = (error as { response?: { status?: unknown } }).response?.status
  return typeof status === 'number' ? status : undefined
}

/**
 * Pull a readable string out of a FastAPI error body.
 *
 * Covers every shape the bridge emits (api-prionex#1113): a plain
 * `{"detail": "text"}` (the brain's own refusal, human-readable), the
 * Pydantic `{"detail": [{"msg": ...}]}` array (our request body failed the
 * input schema — effectively an FE bug), and the structured
 * `{"detail": {"code": ..., "message": ...}}`.
 *
 * A `detail` object with only a `code` yields nothing — the caller falls
 * back to a localized message rather than printing a slug at an admin. Any
 * other object is serialized: the bridge forwards an unrecognized brain
 * body verbatim under `detail`, and raw JSON beats a generic "try again"
 * when it is the only diagnostic that exists.
 */
function readDetailMessage(error: unknown): string | undefined {
  if (!error || typeof error !== 'object' || !('response' in error)) return undefined
  const data = (error as { response?: { data?: unknown } }).response?.data
  if (!data || typeof data !== 'object') return undefined

  const detail = (data as { detail?: unknown }).detail

  if (typeof detail === 'string') return detail.trim() || undefined

  if (Array.isArray(detail)) {
    const joined = detail
      .map((item) =>
        item && typeof item === 'object' && 'msg' in item
          ? String((item as { msg: unknown }).msg)
          : ''
      )
      .filter(Boolean)
      .join('; ')
    return joined || undefined
  }

  if (detail && typeof detail === 'object') {
    const message = (detail as { message?: unknown }).message
    if (typeof message === 'string' && message.trim()) return message

    const keys = Object.keys(detail as Record<string, unknown>)
    if (keys.length > 0 && !(keys.length === 1 && keys[0] === 'code')) {
      return JSON.stringify(detail)
    }
  }

  const message = (data as { message?: unknown }).message
  return typeof message === 'string' && message.trim() ? message : undefined
}

/**
 * The brain-unreachable marker, checked before the status number.
 *
 * The bridge answers 502 for this today, but the code in the body is the
 * stable part of the contract — keying on it means a later switch to 503
 * (or anything else) does not silently degrade this into "unknown error".
 */
function isBrainUnreachable(error: unknown): boolean {
  if (!error || typeof error !== 'object' || !('response' in error)) return false
  const data = (error as { response?: { data?: unknown } }).response?.data
  if (!data || typeof data !== 'object') return false

  const detail = (data as { detail?: unknown }).detail
  if (!detail || typeof detail !== 'object') return false

  return (detail as { code?: unknown }).code === 'brain_unreachable'
}

export function classifyAssistantAdminError(error: unknown): AssistantAdminError {
  const status = readStatus(error)

  if (isBrainUnreachable(error)) return { kind: 'unavailable' }

  if (status === 422 || status === 400) {
    return { kind: 'validation', message: readDetailMessage(error) }
  }
  if (status === 403) return { kind: 'forbidden' }
  if (status === 404) return { kind: 'notFound' }
  if (status === 502 || status === 503) return { kind: 'unavailable' }

  return { kind: 'unknown' }
}
