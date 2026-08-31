/**
 * Third-Party Verification Report Hook
 *
 * React Query hook for fetching the "Верифікація 3-х осіб" report.
 */

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getThirdPartyVerificationReport } from '../api/thirdPartyVerificationApi'
import type { ThirdPartyVerificationParams, ThirdPartyVerificationResponse } from '../api/types'

/**
 * Query keys for the verification report. The whole params object goes into
 * the key, so project, BOTH windows and the timezone each refetch on change.
 */
export const thirdPartyVerificationKeys = {
  all: ['thirdPartyVerification'] as const,
  report: (params: ThirdPartyVerificationParams) =>
    [...thirdPartyVerificationKeys.all, 'report', params] as const,
}

export interface UseThirdPartyVerificationReportParams {
  projectId: number
  sellFrom: string // YYYY-MM-DD
  sellTo: string // YYYY-MM-DD
  /** Optional and INDEPENDENT of `countTo` — one bound alone is a valid filter. */
  countFrom?: string
  /** Optional and INDEPENDENT of `countFrom`. */
  countTo?: string
  /** IANA timezone of the user's profile (backend defaults to UTC when omitted). */
  timezone?: string | null
  enabled?: boolean
}

export function useThirdPartyVerificationReport({
  projectId,
  sellFrom,
  sellTo,
  countFrom,
  countTo,
  timezone,
  enabled = true,
}: UseThirdPartyVerificationReportParams) {
  const params: ThirdPartyVerificationParams = {
    project_id: projectId,
    sell_from: sellFrom,
    sell_to: sellTo,
    // Omitted rather than sent as empty strings: each count bound is an
    // independent optional filter and an empty value would be a 400.
    ...(countFrom ? { count_from: countFrom } : {}),
    ...(countTo ? { count_to: countTo } : {}),
    // Part of the query key via `params`, so a timezone change refetches.
    ...(timezone ? { timezone } : {}),
  }

  return useQuery<ThirdPartyVerificationResponse>({
    queryKey: thirdPartyVerificationKeys.report(params),
    queryFn: () => getThirdPartyVerificationReport(params),
    placeholderData: keepPreviousData,
    enabled: enabled && !!projectId && !!sellFrom && !!sellTo,
    staleTime: 60_000,
    // No query-level retry: the axios client (src/lib/api.ts) already retries
    // transient 502/503/504 and network failures on GET twice with backoff.
    // Same policy as the processing report — see useClientProcessingReport.
    retry: false,
  })
}
