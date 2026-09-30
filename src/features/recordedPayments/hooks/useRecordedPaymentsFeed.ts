/**
 * Recorded Payments Feed Hook
 *
 * React Query hook for fetching the «Внесені платежі» list.
 */

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getRecordedPaymentsFeed } from '../api/recordedPaymentsFeedApi'
import type { RecordedPaymentsFeedParams, RecordedPaymentsFeedResponse } from '../api/types'

/**
 * Query keys for the feed. The whole params object goes into the key, so the
 * project, both window bounds, the operator filter, the verified switch, the
 * page window and the timezone each refetch on change.
 */
export const recordedPaymentsFeedKeys = {
  all: ['recordedPaymentsFeed'] as const,
  feed: (params: RecordedPaymentsFeedParams) =>
    [...recordedPaymentsFeedKeys.all, 'feed', params] as const,
}

export interface UseRecordedPaymentsFeedParams {
  projectId: number
  /**
   * Window start (YYYY-MM-DD). BOTH-OR-NEITHER on the wire: the endpoint
   * answers 400 for exactly one bound and, for none, applies its own default
   * — the current month to date, the same rule the tab's default follows
   * (`../lib/currentMonthWindow`). The hook refuses BOTH cases rather than
   * trusting the caller: a request goes out only once the tab knows its
   * whole window, so the window applied is always the one the tab asked
   * for explicitly, never one filled in on the server. A missing bound
   * therefore DISABLES the query — one date, or none (an unusable "today"),
   * gives ZERO requests, not a different report. The tab always has both in
   * practice; this is the second line.
   */
  dateFrom?: string
  /** Window end (YYYY-MM-DD), inclusive. */
  dateTo?: string
  /** Key B filter — the client's responsible employee, by id. Empty = no filter. */
  userIds?: number[]
  /** «Тільки підтверджені» — `status = 'verified'` only (server-side; default false). */
  verifiedOnly?: boolean
  /** Rows to skip — `(page - 1) * limit`. */
  skip: number
  /** Rows per page (backend default 50, max 200). */
  limit: number
  /**
   * IANA timezone of the user's profile. ALWAYS sent: the backend uses it for
   * one thing only — which month is current when no dates are given — and
   * the tab always gives both, but the contract asks for the zone on every
   * request and a profile without one falls back to the browser's (the
   * drains feed's precedent) rather than to the server's UTC.
   */
  timezone?: string | null
  enabled?: boolean
}

export function useRecordedPaymentsFeed({
  projectId,
  dateFrom,
  dateTo,
  userIds,
  verifiedOnly,
  skip,
  limit,
  timezone,
  enabled = true,
}: UseRecordedPaymentsFeedParams) {
  // Both or neither, never one — and here "neither" is refused too (see the
  // param docs): the request goes out only with a whole window.
  const hasWindow = !!dateFrom && !!dateTo

  const params: RecordedPaymentsFeedParams = {
    project_id: projectId,
    ...(hasWindow ? { date_from: dateFrom, date_to: dateTo } : {}),
    skip,
    limit,
    // Part of the query key via `params`, so a timezone change refetches.
    timezone: timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
    // The false default stays ABSENT rather than spelled out: the backend's
    // own default applies, and a key travels exactly when the answer differs.
    ...(verifiedOnly ? { verified_only: true } : {}),
    // Likewise an empty filter is the absence of the key, not `user_ids=`.
    ...(userIds && userIds.length > 0 ? { user_ids: userIds } : {}),
  }

  return useQuery<RecordedPaymentsFeedResponse>({
    queryKey: recordedPaymentsFeedKeys.feed(params),
    queryFn: () => getRecordedPaymentsFeed(params),
    placeholderData: keepPreviousData,
    // The half-window guard is HERE, in the gate, so that no caller can send
    // one bound by accident — the tab's own `enabled` is the first line.
    enabled: enabled && !!projectId && hasWindow,
    staleTime: 60_000,
    // No query-level retry: the axios client (src/lib/api.ts) already retries
    // transient 502/503/504 and network failures on GET twice with backoff.
    // Same policy as all sibling report tabs.
    retry: false,
  })
}
