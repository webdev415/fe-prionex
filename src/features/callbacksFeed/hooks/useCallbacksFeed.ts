/**
 * Callbacks Feed Hook
 *
 * React Query hook for fetching the «Перезвони» call plan.
 */

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getCallbacksFeed } from '../api/callbacksFeedApi'
import type { CallbacksFeedParams, CallbacksFeedResponse } from '../api/types'

/**
 * Query keys for the feed. The whole params object goes into the key, so the
 * project, both window bounds, both toggles, the page window and the timezone
 * each refetch on change.
 */
export const callbacksFeedKeys = {
  all: ['callbacksFeed'] as const,
  feed: (params: CallbacksFeedParams) => [...callbacksFeedKeys.all, 'feed', params] as const,
}

export interface UseCallbacksFeedParams {
  projectId: number
  /**
   * Window start (YYYY-MM-DD), REQUIRED together with `dateTo`: the backend
   * would default an absent bound to "today" itself, but the tab always sends
   * the pair it SHOWS — the fields and the request must never disagree.
   */
  dateFrom: string
  /** Window end (YYYY-MM-DD), inclusive. */
  dateTo: string
  /** Hide rows whose client was already interacted with today (server-side; backend default false). */
  hideCalledToday?: boolean
  /** Hide callbacks already worked, compared by DATE (server-side; backend default false). */
  hideWorked?: boolean
  /** Rows to skip — `(page - 1) * limit`. */
  skip: number
  /** Rows per page (backend default 50, max 500). */
  limit: number
  /**
   * IANA timezone of the user's profile. When the profile has none, the hook
   * sends the BROWSER's zone instead of omitting the param: the backend cuts
   * the window's calendar days in this zone while the table formats the
   * datetimes browser-locally, and only sending the same zone keeps the two
   * ends agreeing on which day a near-midnight callback belongs to (an omitted
   * param would make the backend cut by UTC).
   */
  timezone?: string | null
  enabled?: boolean
}

export function useCallbacksFeed({
  projectId,
  dateFrom,
  dateTo,
  hideCalledToday,
  hideWorked,
  skip,
  limit,
  timezone,
  enabled = true,
}: UseCallbacksFeedParams) {
  const params: CallbacksFeedParams = {
    project_id: projectId,
    date_from: dateFrom,
    date_to: dateTo,
    skip,
    limit,
    // Part of the query key via `params`, so a timezone change refetches. It
    // cuts the SCHEDULED-callback calendar days for the window — the returned
    // timestamps are absolute UTC instants either way, and the TABLE formats
    // those in the profile timezone independently. ALWAYS sent: a profile
    // without a zone falls back to the browser's (precedent:
    // report/hooks/useModalData), because the table then renders
    // browser-locally and an omitted param would have the backend cut the
    // window by UTC — the feed's days and the cells' days would disagree.
    timezone: timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
    // The false defaults stay ABSENT rather than spelled out, mirroring the
    // timezone policy: the backend's own default applies, and a key travels
    // exactly when the answer would differ.
    ...(hideCalledToday ? { hide_called_today: true } : {}),
    ...(hideWorked ? { hide_worked: true } : {}),
  }

  return useQuery<CallbacksFeedResponse>({
    queryKey: callbacksFeedKeys.feed(params),
    queryFn: () => getCallbacksFeed(params),
    placeholderData: keepPreviousData,
    enabled: enabled && !!projectId,
    staleTime: 60_000,
    // No query-level retry: the axios client (src/lib/api.ts) already retries
    // transient 502/503/504 and network failures on GET twice with backoff.
    // Same policy as all sibling report tabs.
    retry: false,
  })
}
