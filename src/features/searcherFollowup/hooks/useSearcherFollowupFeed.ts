/**
 * Searcher Follow-up Feed Hook
 *
 * React Query hook for fetching the «Відпрацювання серчера» work list.
 */

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getSearcherFollowupFeed } from '../api/searcherFollowupFeedApi'
import type { SearcherFollowupFeedParams, SearcherFollowupResponse } from '../api/types'

/**
 * Query keys for the feed. The whole params object goes into the key, so
 * project, both window bounds, the page window and the timezone each refetch
 * on change.
 */
export const searcherFollowupFeedKeys = {
  all: ['searcherFollowupFeed'] as const,
  feed: (params: SearcherFollowupFeedParams) =>
    [...searcherFollowupFeedKeys.all, 'feed', params] as const,
}

export interface UseSearcherFollowupFeedParams {
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

export function useSearcherFollowupFeed({
  projectId,
  dateStart,
  dateEnd,
  skip,
  limit,
  timezone,
  enabled = true,
}: UseSearcherFollowupFeedParams) {
  const params: SearcherFollowupFeedParams = {
    project_id: projectId,
    date_start: dateStart,
    date_end: dateEnd,
    skip,
    limit,
    // Part of the query key via `params`, so a timezone change refetches. It
    // cuts the calendar day of the searcher interaction for the window only —
    // the returned timestamps are absolute UTC instants either way, and the
    // TABLE formats those in the profile timezone independently.
    ...(timezone ? { timezone } : {}),
  }

  return useQuery<SearcherFollowupResponse>({
    queryKey: searcherFollowupFeedKeys.feed(params),
    queryFn: () => getSearcherFollowupFeed(params),
    placeholderData: keepPreviousData,
    enabled: enabled && !!projectId,
    staleTime: 60_000,
    // No query-level retry: the axios client (src/lib/api.ts) already retries
    // transient 502/503/504 and network failures on GET twice with backoff.
    // Same policy as all three sibling report tabs.
    retry: false,
  })
}
