/**
 * Communication Statistics Hook
 *
 * React Query hook for fetching call and SMS statistics.
 */

import { useQuery } from '@tanstack/react-query'
import { reportApi } from '../api/reportApi'
import type { CommunicationStatisticsParams } from '../api/types'
import { transformCommunicationStatistics } from '../utils/transformers'
import type { CommunicationStatisticsUI } from '../types'

/**
 * Query keys for communication statistics
 */
export const communicationStatisticsKeys = {
  all: ['reports', 'communication-statistics'] as const,
  byProject: (projectId: number) => [...communicationStatisticsKeys.all, projectId] as const,
  byParams: (params: CommunicationStatisticsParams) =>
    [...communicationStatisticsKeys.all, params] as const,
}

/**
 * Communication statistics hook params
 */
export interface UseCommunicationStatisticsParams {
  projectId: number
  fromDate?: string
  toDate?: string
  enabled?: boolean
}

/**
 * Hook for fetching communication statistics
 *
 * @example
 * ```tsx
 * // Default 7 days
 * const { data } = useCommunicationStatistics({ projectId: 1 })
 *
 * // Custom date range
 * const { data } = useCommunicationStatistics({
 *   projectId: 1,
 *   fromDate: '2026-01-01',
 *   toDate: '2026-01-07',
 * })
 * ```
 */
export function useCommunicationStatistics({
  projectId,
  fromDate,
  toDate,
  enabled = true,
}: UseCommunicationStatisticsParams) {
  const backendParams: CommunicationStatisticsParams = {
    project_id: projectId,
    from_date: fromDate,
    to_date: toDate,
  }

  return useQuery<CommunicationStatisticsUI>({
    queryKey: communicationStatisticsKeys.byParams(backendParams),
    queryFn: async () => {
      const data = await reportApi.getCommunicationStatistics(backendParams)
      return transformCommunicationStatistics(data)
    },
    enabled: enabled && !!projectId,
    staleTime: 60000, // 1 minute
    refetchInterval: 300000, // 5 minutes
    retry: 2,
  })
}

/**
 * Hook for getting only call statistics
 */
export function useCallStatistics(params: UseCommunicationStatisticsParams) {
  const query = useCommunicationStatistics(params)

  return {
    ...query,
    data: query.data?.callStatistics,
  }
}

/**
 * Hook for getting only SMS statistics
 */
export function useSMSStatistics(params: UseCommunicationStatisticsParams) {
  const query = useCommunicationStatistics(params)

  return {
    ...query,
    data: query.data?.smsStatistics,
  }
}

/**
 * Hook for getting daily communication trends
 */
export function useCommunicationTrends(params: UseCommunicationStatisticsParams) {
  const query = useCommunicationStatistics(params)

  return {
    ...query,
    data: query.data?.dailyTrends,
  }
}
