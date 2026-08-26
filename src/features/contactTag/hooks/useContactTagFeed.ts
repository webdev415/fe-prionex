/**
 * Contact-Tag Feed Hook
 *
 * React Query hook for fetching the «Контакт/Неконтакт» work list.
 */

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getContactTagFeed } from '../api/contactTagFeedApi'
import type { ContactTagFeedParams, ContactTagFeedResponse } from '../api/types'
import { sellToRequestParam, type SellToState } from '../utils/sellWindow'

/**
 * Query keys for the feed. The whole params object goes into the key, so
 * project, the view date, both sell bounds, the page window and the timezone
 * each refetch on change.
 *
 * The three `sell_to` states produce three DIFFERENT keys — `{}`,
 * `{ sell_to: '' }` and `{ sell_to: '2026-06-30' }` — which is what makes
 * switching the upper bound off actually refetch instead of replaying the
 * defaulted window from cache.
 */
export const contactTagFeedKeys = {
  all: ['contactTagFeed'] as const,
  feed: (params: ContactTagFeedParams) => [...contactTagFeedKeys.all, 'feed', params] as const,
}

export interface UseContactTagFeedParams {
  projectId: number
  /**
   * The REQUIRED reference day (YYYY-MM-DD) the staleness thresholds and the
   * promise gate are measured against. The backend has no default for it, and
   * neither does the wire: the tab always sends the day it shows.
   */
  viewDate: string
  /** Lower bound on the last debt purchase date; omitted when unset. */
  sellFrom?: string
  /**
   * The upper bound's STATE, not its value — the three-valued machine of
   * `utils/sellWindow.ts`. Passing a bare `string | undefined` here would
   * destroy the very distinction the contract is built on, since `undefined`
   * cannot mean both "apply the backend default" and "no upper bound".
   */
  sellTo: SellToState
  /** Rows to skip — `(page - 1) * limit`. */
  skip: number
  /** Rows per page (backend default 50, max 500). */
  limit: number
  /** IANA timezone of the user's profile (backend defaults to UTC when omitted). */
  timezone?: string | null
  enabled?: boolean
}

export function useContactTagFeed({
  projectId,
  viewDate,
  sellFrom,
  sellTo,
  skip,
  limit,
  timezone,
  enabled = true,
}: UseContactTagFeedParams) {
  const params: ContactTagFeedParams = {
    project_id: projectId,
    view_date: viewDate,
    // Absent and empty mean the same thing for the LOWER bound (no default), so
    // an unset one is simply omitted.
    ...(sellFrom ? { sell_from: sellFrom } : {}),
    // ...whereas the upper bound's absence is a THIRD state. The spread is what
    // keeps "key omitted" a real omission rather than an `undefined` value.
    ...sellToRequestParam(sellTo),
    skip,
    limit,
    // Part of the query key via `params`, so a timezone change refetches. It
    // cuts the calendar day of `assignment_date` and of the promise date — and
    // the latter can flip whether a row EXISTS, since the promise gate compares
    // that day against `view_date`. It does not touch `last_interaction_date`,
    // which keeps the card's UTC cut.
    ...(timezone ? { timezone } : {}),
  }

  return useQuery<ContactTagFeedResponse>({
    queryKey: contactTagFeedKeys.feed(params),
    queryFn: () => getContactTagFeed(params),
    placeholderData: keepPreviousData,
    enabled: enabled && !!projectId,
    // The endpoint caches a computed feed for 15 minutes per worker, but that
    // cache is keyed on the WINDOW only — paging through ~880 pages still costs
    // a round trip each. This client-side window is what keeps a tab switch (or
    // a sub-tab click, which does not change the request at all) from refiring
    // one. Same minute as every sibling report tab.
    staleTime: 60_000,
    // No query-level retry: the axios client (src/lib/api.ts) already retries
    // transient 502/503/504 and network failures on GET twice with backoff.
    // Same policy as every sibling report tab.
    retry: false,
  })
}
