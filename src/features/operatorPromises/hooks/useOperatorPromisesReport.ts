/**
 * Operator Promises Report Hook
 *
 * React Query hook for fetching the «Обіцянки по операторах» report.
 */

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getOperatorPromisesReport } from '../api/operatorPromisesApi'
import type { OperatorPromisesReportParams, OperatorPromisesReportResponse } from '../api/types'

/**
 * Query keys for the report. The whole params object goes into the key, so the
 * project, both window bounds and the timezone each refetch on change — the
 * same tuple the backend caches on.
 */
export const operatorPromisesReportKeys = {
  all: ['operatorPromisesReport'] as const,
  report: (params: OperatorPromisesReportParams) =>
    [...operatorPromisesReportKeys.all, 'report', params] as const,
}

export interface UseOperatorPromisesReportParams {
  projectId: number
  /** REQUIRED window start (YYYY-MM-DD) — this endpoint has no default period. */
  dateFrom: string
  /** REQUIRED window end (YYYY-MM-DD), inclusive. */
  dateTo: string
  /** IANA timezone of the user's profile (backend defaults to UTC when omitted). */
  timezone?: string | null
  enabled?: boolean
}

export function useOperatorPromisesReport({
  projectId,
  dateFrom,
  dateTo,
  timezone,
  enabled = true,
}: UseOperatorPromisesReportParams) {
  const params: OperatorPromisesReportParams = {
    project_id: projectId,
    date_from: dateFrom,
    date_to: dateTo,
    // Part of the query key via `params`, so a timezone change refetches. It
    // moves the PROMISED-date cut only — `sum_to` differs by 0.34 % between UTC
    // and Europe/Kyiv on the July 2026 window — and cannot touch the
    // interaction window (a UTC cut, card parity) or the payment window
    // (`payment_date` is a DATE). Nothing is ever shifted client-side.
    ...(timezone ? { timezone } : {}),
  }

  return useQuery<OperatorPromisesReportResponse>({
    queryKey: operatorPromisesReportKeys.report(params),
    queryFn: () => getOperatorPromisesReport(params),
    placeholderData: keepPreviousData,
    enabled: enabled && !!projectId,
    // A short client staleTime is enough because the expensive part is guarded
    // server-side: a computed report is re-served from the worker-local cache
    // for 15 minutes (a MISS costs 2–8 s of SQL), and `generated_at` states the
    // answer's real age. Same value as every sibling report tab.
    staleTime: 60_000,
    // No query-level retry: the axios client (src/lib/api.ts) already retries
    // transient 502/503/504 and network failures on GET twice with backoff.
    // Same policy as all five sibling report tabs.
    retry: false,
  })
}
