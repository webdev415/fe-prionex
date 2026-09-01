/**
 * Outbound Calls Report Hook
 *
 * React Query hook for fetching the «Вихідні дзвінки» report.
 */

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getOutboundCallsReport } from '../api/outboundCallsApi'
import type { OutboundCallsReportParams, OutboundCallsReportResponse } from '../api/types'

/**
 * Query keys for the report. The whole params object goes into the key, so the
 * project, both window bounds and the timezone each refetch on change.
 */
export const outboundCallsReportKeys = {
  all: ['outboundCallsReport'] as const,
  report: (params: OutboundCallsReportParams) =>
    [...outboundCallsReportKeys.all, 'report', params] as const,
}

export interface UseOutboundCallsReportParams {
  projectId: number
  /** REQUIRED window start (YYYY-MM-DD) — this endpoint has no default period. */
  dateStart: string
  /** REQUIRED window end (YYYY-MM-DD), inclusive. */
  dateEnd: string
  /** IANA timezone of the user's profile (backend defaults to UTC when omitted). */
  timezone?: string | null
  enabled?: boolean
}

export function useOutboundCallsReport({
  projectId,
  dateStart,
  dateEnd,
  timezone,
  enabled = true,
}: UseOutboundCallsReportParams) {
  const params: OutboundCallsReportParams = {
    project_id: projectId,
    date_start: dateStart,
    date_end: dateEnd,
    // Part of the query key via `params`, so a timezone change refetches. It
    // decides which calendar days the window covers and moves no returned
    // number by itself.
    ...(timezone ? { timezone } : {}),
  }

  return useQuery<OutboundCallsReportResponse>({
    queryKey: outboundCallsReportKeys.report(params),
    queryFn: () => getOutboundCallsReport(params),
    placeholderData: keepPreviousData,
    enabled: enabled && !!projectId && !!dateStart && !!dateEnd,
    // The report is NOT cached server-side (a month costs ~0.3 s of
    // aggregation), so this staleTime is the only thing standing between a
    // tab switch and a repeat walk of the call history. Same value as every
    // sibling report tab.
    staleTime: 60_000,
    // No query-level retry: the axios client (src/lib/api.ts) already retries
    // transient 502/503/504 and network failures on GET twice with backoff.
    // Same policy as the sibling report tabs.
    retry: false,
  })
}
