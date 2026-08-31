/**
 * Communication-Gap Feed Hook
 *
 * React Query hook for fetching the «Великий розрив» work list.
 */

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getCommunicationGapFeed } from '../api/communicationGapFeedApi'
import type { CommunicationGapFeedParams, CommunicationGapFeedResponse } from '../api/types'

/**
 * Query keys for the feed. The whole params object goes into the key, so
 * project, both sell bounds, `gap_min`, the page window and the timezone each
 * refetch on change.
 */
export const communicationGapFeedKeys = {
  all: ['communicationGapFeed'] as const,
  feed: (params: CommunicationGapFeedParams) =>
    [...communicationGapFeedKeys.all, 'feed', params] as const,
}

export interface UseCommunicationGapFeedParams {
  projectId: number
  /** Optional and INDEPENDENT of `sellTo` — one bound alone is a valid filter. */
  sellFrom?: string // YYYY-MM-DD
  /** Optional and INDEPENDENT of `sellFrom`. */
  sellTo?: string // YYYY-MM-DD
  /** Optional floor on the days of silence; `0` is a value, not "absent". */
  gapMin?: number
  /** Rows to skip — `(page - 1) * limit`. */
  skip: number
  /** Rows per page (backend default 50, max 500). */
  limit: number
  /** IANA timezone of the user's profile (backend defaults to UTC when omitted). */
  timezone?: string | null
  enabled?: boolean
}

export function useCommunicationGapFeed({
  projectId,
  sellFrom,
  sellTo,
  gapMin,
  skip,
  limit,
  timezone,
  enabled = true,
}: UseCommunicationGapFeedParams) {
  const params: CommunicationGapFeedParams = {
    project_id: projectId,
    // Omitted rather than sent as empty strings: each bound is an independent
    // optional filter and an empty value would be a 400.
    ...(sellFrom ? { sell_from: sellFrom } : {}),
    ...(sellTo ? { sell_to: sellTo } : {}),
    // Explicit undefined check, NOT a truthiness one: `gap_min=0` is the
    // backend's own floor (`ge=0`) and a legitimate thing to type, so a falsy
    // guard would silently drop it and change which rows the operator sees.
    ...(gapMin === undefined ? {} : { gap_min: gapMin }),
    skip,
    limit,
    // Part of the query key via `params`, so a timezone change refetches. It
    // governs the reference "today" the gap is measured against, the cuts of
    // `assignment_date` / `last_promise_date` and the 30-day payment window —
    // the promise cut can even flip whether a row exists. It does NOT touch
    // `last_interaction_date` (UTC cut server-side, Card 125 parity), and
    // nothing is ever shifted client-side.
    ...(timezone ? { timezone } : {}),
  }

  return useQuery<CommunicationGapFeedResponse>({
    queryKey: communicationGapFeedKeys.feed(params),
    queryFn: () => getCommunicationGapFeed(params),
    placeholderData: keepPreviousData,
    enabled: enabled && !!projectId,
    staleTime: 60_000,
    // No query-level retry: the axios client (src/lib/api.ts) already retries
    // transient 502/503/504 and network failures on GET twice with backoff.
    // Same policy as all four sibling report tabs — and the reason the
    // endpoint's candidate-cap refusal is a 400 rather than a 503: a 503 would
    // be re-run over the very population the cap refuses to process.
    retry: false,
  })
}
