/**
 * Promises Daily Report Hook
 *
 * React Query hook for fetching the «Обіцянки до кінця місяця» report.
 */

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getPromisesDailyReport } from '../api/promisesDailyApi'
import type { PromisesDailyReportParams, PromisesDailyReportResponse } from '../api/types'

/**
 * Query keys for the report. The whole params object goes into the key, so the
 * project, both window bounds, the timezone and the possible-payment switch
 * each refetch on change — the same tuple the backend caches on.
 */
export const promisesDailyReportKeys = {
  all: ['promisesDailyReport'] as const,
  report: (params: PromisesDailyReportParams) =>
    [...promisesDailyReportKeys.all, 'report', params] as const,
}

export interface UsePromisesDailyReportParams {
  projectId: number
  /** REQUIRED window start (YYYY-MM-DD) — this endpoint has no default period. */
  dateFrom: string
  /** REQUIRED window end (YYYY-MM-DD), inclusive. */
  dateTo: string
  /** IANA timezone of the user's profile (backend defaults to UTC when omitted). */
  timezone?: string | null
  /** Count the «possible payment» agreement subtype too (backend defaults to false). */
  possiblePayment?: boolean
  enabled?: boolean
}

export function usePromisesDailyReport({
  projectId,
  dateFrom,
  dateTo,
  timezone,
  possiblePayment,
  enabled = true,
}: UsePromisesDailyReportParams) {
  const params: PromisesDailyReportParams = {
    project_id: projectId,
    date_from: dateFrom,
    date_to: dateTo,
    // Part of the query key via `params`, so a timezone change refetches. It
    // cuts the PROMISED-date calendar days and nothing else; omitted, the
    // backend defaults to UTC.
    ...(timezone ? { timezone } : {}),
    // The false default stays ABSENT rather than spelled out, mirroring the
    // timezone policy: the backend's own default applies, and the key changes
    // exactly when the answer would.
    ...(possiblePayment ? { possible_payment: true } : {}),
  }

  return useQuery<PromisesDailyReportResponse>({
    queryKey: promisesDailyReportKeys.report(params),
    queryFn: () => getPromisesDailyReport(params),
    placeholderData: keepPreviousData,
    enabled: enabled && !!projectId && !!dateFrom && !!dateTo,
    // A short client staleTime is enough because the expensive part is guarded
    // server-side: a computed report is re-served from the worker-local cache
    // for 15 minutes (a MISS costs ~5-6 s of SQL), and `generated_at` states
    // the answer's real age. Same value as every sibling report tab.
    staleTime: 60_000,
    // No query-level retry: the axios client (src/lib/api.ts) already retries
    // transient 502/503/504 and network failures on GET twice with backoff.
    // Same policy as all sibling report tabs.
    retry: false,
  })
}
