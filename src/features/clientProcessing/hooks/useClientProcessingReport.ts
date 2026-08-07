/**
 * Client Processing Report Hook
 *
 * React Query hook for fetching the "Відпрацювання за ЦД" report.
 */

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getClientProcessingReport } from '../api/clientProcessingApi'
import type { ProcessingReportParams, ProcessingReportResponse } from '../api/types'

/** Query keys for the processing report (dates + project in the key). */
export const clientProcessingKeys = {
  all: ['clientProcessing'] as const,
  report: (params: ProcessingReportParams) =>
    [...clientProcessingKeys.all, 'report', params] as const,
}

export interface UseClientProcessingReportParams {
  projectId: number
  dateStart: string // YYYY-MM-DD
  dateEnd: string // YYYY-MM-DD
  /** IANA timezone of the user's profile (backend defaults to UTC when omitted). */
  timezone?: string | null
  enabled?: boolean
}

export function useClientProcessingReport({
  projectId,
  dateStart,
  dateEnd,
  timezone,
  enabled = true,
}: UseClientProcessingReportParams) {
  const params: ProcessingReportParams = {
    project_id: projectId,
    date_start: dateStart,
    date_end: dateEnd,
    // Part of the query key via `params`, so a timezone change refetches.
    ...(timezone ? { timezone } : {}),
  }

  return useQuery<ProcessingReportResponse>({
    queryKey: clientProcessingKeys.report(params),
    queryFn: () => getClientProcessingReport(params),
    placeholderData: keepPreviousData,
    enabled: enabled && !!projectId && !!dateStart && !!dateEnd,
    staleTime: 60_000,
    // No query-level retry: the axios client (src/lib/api.ts) already retries
    // transient 502/503/504 and network failures on GET requests twice with
    // backoff (~1.5s total). An error reaching React Query has therefore
    // either survived those retries or is non-transient (4xx) — retrying
    // again here would only delay the error state (which has its own
    // user-facing "temporarily unavailable" message + Retry button).
    retry: false,
  })
}
