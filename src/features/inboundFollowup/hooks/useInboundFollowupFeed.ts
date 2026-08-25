/**
 * Inbound Follow-up Feed Hook
 *
 * React Query hook for fetching the «Вхід без відпрацювання» work list.
 */

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getInboundFollowupFeed } from '../api/inboundFollowupFeedApi'
import type { InboundFollowupFeedParams, InboundFollowupResponse } from '../api/types'

/**
 * Query keys for the feed. The whole params object goes into the key, so
 * project, both window bounds, the page window and the timezone each refetch
 * on change.
 */
export const inboundFollowupFeedKeys = {
  all: ['inboundFollowupFeed'] as const,
  feed: (params: InboundFollowupFeedParams) =>
    [...inboundFollowupFeedKeys.all, 'feed', params] as const,
}

export interface UseInboundFollowupFeedParams {
  projectId: number
  /**
   * Window start, REQUIRED together with `dateEnd`: the backend accepts
   * both-or-neither (400 on half a window), and this tab always sends both —
   * its default is today–today in the profile timezone, so the whole-history
   * mode (neither bound) is never requested from the UI.
   */
  dateStart: string // YYYY-MM-DD
  dateEnd: string // YYYY-MM-DD
  /** Rows to skip — `(page - 1) * limit`. */
  skip: number
  /** Rows per page (backend default 50, max 500). */
  limit: number
  /** IANA timezone of the user's profile (backend defaults to UTC when omitted). */
  timezone?: string | null
  enabled?: boolean
}

export function useInboundFollowupFeed({
  projectId,
  dateStart,
  dateEnd,
  skip,
  limit,
  timezone,
  enabled = true,
}: UseInboundFollowupFeedParams) {
  const params: InboundFollowupFeedParams = {
    project_id: projectId,
    date_start: dateStart,
    date_end: dateEnd,
    skip,
    limit,
    // Part of the query key via `params`, so a timezone change refetches. It
    // cuts the calendar day of the interaction for the window only — the
    // returned timestamps are absolute UTC instants either way, and the TABLE
    // formats those in the profile timezone independently.
    ...(timezone ? { timezone } : {}),
  }

  return useQuery<InboundFollowupResponse>({
    queryKey: inboundFollowupFeedKeys.feed(params),
    queryFn: () => getInboundFollowupFeed(params),
    placeholderData: keepPreviousData,
    enabled: enabled && !!projectId,
    // The endpoint has no result cache of its own (the feed is 1-8 rows a day),
    // so this client-side window is the only thing keeping a tab switch from
    // recomputing it. Same minute as every sibling report tab.
    staleTime: 60_000,
    // No query-level retry: the axios client (src/lib/api.ts) already retries
    // transient 502/503/504 and network failures on GET twice with backoff.
    // Same policy as all four sibling report tabs.
    retry: false,
  })
}
