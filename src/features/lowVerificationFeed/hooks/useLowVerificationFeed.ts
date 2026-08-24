/**
 * Low-Verification Feed Hook
 *
 * React Query hook for fetching the «Мало верифікацій 3-х осіб» work list.
 */

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getLowVerificationFeed } from '../api/lowVerificationFeedApi'
import type { LowVerificationFeedParams, LowVerificationFeedResponse } from '../api/types'

/**
 * Query keys for the feed. The whole params object goes into the key, so
 * project, both sell bounds, `max_verified`, the page window and the timezone
 * each refetch on change.
 */
export const lowVerificationFeedKeys = {
  all: ['lowVerificationFeed'] as const,
  feed: (params: LowVerificationFeedParams) =>
    [...lowVerificationFeedKeys.all, 'feed', params] as const,
}

export interface UseLowVerificationFeedParams {
  projectId: number
  /** Optional and INDEPENDENT of `sellTo` — one bound alone is a valid filter. */
  sellFrom?: string // YYYY-MM-DD
  /** Optional and INDEPENDENT of `sellFrom`. */
  sellTo?: string // YYYY-MM-DD
  /** Optional cap on verified third-party contacts; `0` is meaningful. */
  maxVerified?: number
  /** Rows to skip — `(page - 1) * limit`. */
  skip: number
  /** Rows per page (backend default 50, max 500). */
  limit: number
  /** IANA timezone of the user's profile (backend defaults to UTC when omitted). */
  timezone?: string | null
  enabled?: boolean
}

export function useLowVerificationFeed({
  projectId,
  sellFrom,
  sellTo,
  maxVerified,
  skip,
  limit,
  timezone,
  enabled = true,
}: UseLowVerificationFeedParams) {
  const params: LowVerificationFeedParams = {
    project_id: projectId,
    // Omitted rather than sent as empty strings: each bound is an independent
    // optional filter and an empty value would be a 400.
    ...(sellFrom ? { sell_from: sellFrom } : {}),
    ...(sellTo ? { sell_to: sellTo } : {}),
    // Explicit undefined check, NOT a truthiness one: `max_verified=0` ("never
    // verified since the purchase") is the single most useful value of this
    // filter and a falsy guard would silently drop it.
    ...(maxVerified === undefined ? {} : { max_verified: maxVerified }),
    skip,
    limit,
    // Part of the query key via `params`, so a timezone change refetches. It
    // cuts `assignment_date` only — `last_interaction_date` stays a UTC cut
    // server-side (Card 148 parity) and must never be shifted client-side.
    ...(timezone ? { timezone } : {}),
  }

  return useQuery<LowVerificationFeedResponse>({
    queryKey: lowVerificationFeedKeys.feed(params),
    queryFn: () => getLowVerificationFeed(params),
    placeholderData: keepPreviousData,
    enabled: enabled && !!projectId,
    staleTime: 60_000,
    // No query-level retry: the axios client (src/lib/api.ts) already retries
    // transient 502/503/504 and network failures on GET twice with backoff.
    // Same policy as both sibling reports.
    retry: false,
  })
}
