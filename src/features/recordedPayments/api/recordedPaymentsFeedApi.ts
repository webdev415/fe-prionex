/**
 * Recorded Payments Feed API
 *
 * API call to the PAYMENT-service recorded-payments feed endpoint — the first
 * report tab whose data lives in the payment service rather than the client
 * service. Same axios client (goes through Kong on port 8000, where the
 * `/api/v1/payments` prefix is already published).
 */

import api from '@/lib/api'
import type { RecordedPaymentsFeedParams, RecordedPaymentsFeedResponse } from './types'

const RECORDED_PAYMENTS_FEED_URL = '/api/v1/payments/reports/feeds/recorded-payments'

/**
 * The query string, built by hand rather than left to axios' default
 * serialiser: axios spells an array as `user_ids[]=1&user_ids[]=2`, and
 * FastAPI reads a `list[int]` query parameter only from REPEATED bare keys
 * (`user_ids=1&user_ids=2`) — the bracketed form is an unknown parameter and
 * the filter silently does not apply. Same construction as the coaching
 * queue's `user_ids` (features/quality/coaching/api.ts). Every other key is
 * appended only when present, so an omitted date or flag stays ABSENT (a null
 * would travel as `date_from=`, a PRESENT parameter as far as FastAPI is
 * concerned, and earn a 400 for a half-specified window).
 */
export function buildRecordedPaymentsFeedQuery(
  params: RecordedPaymentsFeedParams
): URLSearchParams {
  const query = new URLSearchParams()
  query.set('project_id', String(params.project_id))
  if (params.date_from !== undefined) query.set('date_from', params.date_from)
  if (params.date_to !== undefined) query.set('date_to', params.date_to)
  if (params.timezone !== undefined) query.set('timezone', params.timezone)
  params.user_ids?.forEach((id) => query.append('user_ids', String(id)))
  if (params.verified_only !== undefined) query.set('verified_only', String(params.verified_only))
  if (params.skip !== undefined) query.set('skip', String(params.skip))
  if (params.limit !== undefined) query.set('limit', String(params.limit))
  return query
}

/**
 * Get the «Внесені платежі» list (one row per PAYMENT whose bank confirmation
 * date falls inside the window), with the whole-selection summary and the
 * per-responsible breakdown.
 */
export async function getRecordedPaymentsFeed(
  params: RecordedPaymentsFeedParams
): Promise<RecordedPaymentsFeedResponse> {
  const response = await api.get<RecordedPaymentsFeedResponse>(RECORDED_PAYMENTS_FEED_URL, {
    params: buildRecordedPaymentsFeedQuery(params),
  })
  return response.data
}
