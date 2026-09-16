/**
 * Drains Feed Hook
 *
 * React Query hook for fetching the «Зливи» broken-promise list.
 */

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getDrainsFeed } from '../api/drainsFeedApi'
import type { DrainsFeedParams, DrainsFeedResponse } from '../api/types'

/**
 * Query keys for the feed. The whole params object goes into the key, so the
 * project, both window bounds (INCLUDING their absence — the all-history mode
 * is a different key from any window), all three toggles, the page window and
 * the timezone each refetch on change.
 */
export const drainsFeedKeys = {
  all: ['drainsFeed'] as const,
  feed: (params: DrainsFeedParams) => [...drainsFeedKeys.all, 'feed', params] as const,
}

export interface UseDrainsFeedParams {
  projectId: number
  /**
   * Window start (YYYY-MM-DD), or `undefined` for the all-history mode.
   *
   * BOTH-OR-NEITHER, and the hook enforces it rather than trusting the caller:
   * the endpoint answers 400 for exactly one bound, so a half-specified pair
   * must never reach it. The tab blocks that case with a visible complaint
   * before the query is even enabled; this is the second line.
   */
  dateFrom?: string
  /** Window end (YYYY-MM-DD), inclusive — or `undefined`, together with `dateFrom`. */
  dateTo?: string
  /** Hide clients already touched today (server-side; backend default false). */
  hideWorkedToday?: boolean
  /** Hide rows whose promised day a ЦД has reached, by DATE (server-side; default false). */
  hideWorked?: boolean
  /** Hide rows with a non-zero payment — partial payers (server-side; default false). */
  hidePaid?: boolean
  /** Rows to skip — `(page - 1) * limit`. */
  skip: number
  /** Rows per page (backend default 50, max 500). */
  limit: number
  /**
   * IANA timezone of the user's profile. When the profile has none, the hook
   * sends the BROWSER's zone instead of omitting the param: the backend cuts
   * the promised-day window in this zone while the table formats the datetimes
   * browser-locally, and only sending the same zone keeps the two ends
   * agreeing on which day a promise belongs to (an omitted param would make
   * the backend cut by UTC). It matters more here than on the sibling feeds —
   * 11.98 % of this card's promises change calendar day under the Kyiv shift.
   * ⚠️ It travels in the ALL-HISTORY mode too, where there is no window to
   * cut: the zone still anchors "today" for the worked flag and for the right
   * edge of the payment window, which is the feed's row gate.
   */
  timezone?: string | null
  enabled?: boolean
}

export function useDrainsFeed({
  projectId,
  dateFrom,
  dateTo,
  hideWorkedToday,
  hideWorked,
  hidePaid,
  skip,
  limit,
  timezone,
  enabled = true,
}: UseDrainsFeedParams) {
  // Both or neither, never one: a half-specified window answers 400. Spelled
  // as one condition over the pair rather than two independent spreads, so the
  // rule is readable as the rule instead of as an accident of two lines.
  const hasWindow = !!dateFrom && !!dateTo

  const params: DrainsFeedParams = {
    project_id: projectId,
    // ABSENT, not null and not empty strings: omitting both dates is the
    // endpoint's all-history mode, and axios would serialise a null key as
    // `date_from=` — which is a PRESENT parameter as far as FastAPI is
    // concerned and would earn a 400 for a half-specified window.
    ...(hasWindow ? { date_from: dateFrom, date_to: dateTo } : {}),
    skip,
    limit,
    // Part of the query key via `params`, so a timezone change refetches. It
    // cuts the promised-payment calendar days for the window — the returned
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
    ...(hideWorkedToday ? { hide_worked_today: true } : {}),
    ...(hideWorked ? { hide_worked: true } : {}),
    ...(hidePaid ? { hide_paid: true } : {}),
  }

  return useQuery<DrainsFeedResponse>({
    queryKey: drainsFeedKeys.feed(params),
    queryFn: () => getDrainsFeed(params),
    placeholderData: keepPreviousData,
    enabled: enabled && !!projectId,
    staleTime: 60_000,
    // No query-level retry: the axios client (src/lib/api.ts) already retries
    // transient 502/503/504 and network failures on GET twice with backoff.
    // Same policy as all sibling report tabs.
    retry: false,
  })
}
