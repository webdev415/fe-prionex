/**
 * What a failed workday request means for the screen.
 *
 * The shared ladder (`useFeedErrorMessage`) already handles 403, a 400 with a
 * coded detail (translated through `codes.<CODE>`) and the generic fallback.
 * This report adds three answers the ladder cannot tell apart, all decided by
 * status + `code` and never by the English `detail`:
 *
 * - 404 WITHOUT a code — the report is switched off (`WORKDAY_REPORT_ENABLED`
 *   answers `{"detail": "Not Found"}`, «as if the route did not exist») or
 *   the backend that serves it is not deployed yet. Both read the same to an
 *   operator: the report is not available here. An empty state, no retry.
 * - 404 `WORKDAY_OPERATOR_NOT_FOUND` — the operator left the report's
 *   population (modals only).
 * - 503 `WORKDAY_MONTH_NOT_READY` — more stale days than may be computed
 *   live; healed by the nightly job, so the screen lists the days and does
 *   NOT retry by itself.
 * - any other 503 — busy / deadline / a source down: «try again in N s»,
 *   N from `params.retry_after_seconds` (the `Retry-After` header may be
 *   invisible to the browser under Kong's credentialed CORS, which is why the
 *   contract duplicates it in `params`), the header as a fallback.
 */

import { getErrorCode, getErrorStatus, isApiError } from '@/lib/errors'
import { isFiniteNumber } from './format'

export const WORKDAY_ERROR_CODES = {
  operatorNotFound: 'WORKDAY_OPERATOR_NOT_FOUND',
  monthNotReady: 'WORKDAY_MONTH_NOT_READY',
} as const

export type WorkdayFailure =
  | { kind: 'notAvailable' }
  | { kind: 'operatorNotFound' }
  | {
      kind: 'monthNotReady'
      month: string | null
      staleDays: string[]
      retryAfterSeconds: number | null
    }
  | { kind: 'retryLater'; code: string | null; retryAfterSeconds: number | null }
  | { kind: 'other' }

/** The coded answer's `params` object, or {} when there is none. */
export function responseParams(error: unknown): Record<string, unknown> {
  if (!isApiError(error)) return {}
  const data = error.response?.data
  if (!data || typeof data !== 'object') return {}
  const params = (data as Record<string, unknown>).params
  return params && typeof params === 'object' ? (params as Record<string, unknown>) : {}
}

function retryAfterHeader(error: unknown): number | null {
  if (!isApiError(error)) return null
  const headers = error.response?.headers as Record<string, unknown> | undefined
  const raw = headers?.['retry-after'] ?? headers?.['Retry-After']
  const seconds = typeof raw === 'string' ? Number(raw) : raw
  return isFiniteNumber(seconds) && seconds > 0 ? seconds : null
}

/** `params.retry_after_seconds`, else the `Retry-After` header, else null. */
export function retryAfterSeconds(error: unknown): number | null {
  const fromParams = responseParams(error).retry_after_seconds
  if (isFiniteNumber(fromParams) && fromParams > 0) return fromParams
  return retryAfterHeader(error)
}

export function classifyWorkdayFailure(error: unknown): WorkdayFailure {
  const status = getErrorStatus(error)
  const code = getErrorCode(error)

  if (status === 404) {
    return code === WORKDAY_ERROR_CODES.operatorNotFound
      ? { kind: 'operatorNotFound' }
      : { kind: 'notAvailable' }
  }

  if (status === 503) {
    if (code === WORKDAY_ERROR_CODES.monthNotReady) {
      const params = responseParams(error)
      const staleDays = Array.isArray(params.stale_days)
        ? params.stale_days.filter((day): day is string => typeof day === 'string')
        : []
      return {
        kind: 'monthNotReady',
        month: typeof params.month === 'string' ? params.month : null,
        staleDays,
        retryAfterSeconds: retryAfterSeconds(error),
      }
    }
    return { kind: 'retryLater', code, retryAfterSeconds: retryAfterSeconds(error) }
  }

  return { kind: 'other' }
}
