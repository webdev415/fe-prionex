/**
 * Planner error envelope `{"error":{"code","message","request_id","details"}}`.
 *
 * The UI localizes by `code` (and a few `details` keys) with its own text;
 * the server `message` is for developers and is never shown (epic 1, «Тексти»).
 */
import axios from 'axios'
import type { PlannerErrorBody } from './plannerApi'

export interface PlannerError {
  status: number | undefined
  code: string | undefined
  details: Record<string, unknown>
}

export function readPlannerError(error: unknown): PlannerError {
  if (!axios.isAxiosError(error)) return { status: undefined, code: undefined, details: {} }
  const data = error.response?.data as { error?: Partial<PlannerErrorBody> } | undefined
  const body = data && typeof data === 'object' ? data.error : undefined
  const details =
    body?.details && typeof body.details === 'object'
      ? (body.details as Record<string, unknown>)
      : {}
  return {
    status: error.response?.status,
    code: typeof body?.code === 'string' ? body.code : undefined,
    details,
  }
}
