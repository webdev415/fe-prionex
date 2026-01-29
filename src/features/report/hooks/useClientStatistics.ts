/**
 * Client Statistics Hook
 *
 * React Query hook for fetching client statistics data.
 */

import { useQuery } from '@tanstack/react-query'
import { reportApi } from '../api/reportApi'
import type { ClientStatisticsParams } from '../api/types'
import { transformClientStatistics } from '../utils/transformers'
import type { ClientStatisticsUI } from '../types'

/**
 * Query keys for client statistics
 */
export const clientStatisticsKeys = {
  all: ['reports', 'client-statistics'] as const,
  byProject: (projectId: number) =>
    [...clientStatisticsKeys.all, projectId] as const,
  byParams: (params: ClientStatisticsParams) =>
    [...clientStatisticsKeys.all, params] as const,
}

/**
 * Client statistics hook params
 */
export interface UseClientStatisticsParams {
  projectId: number
  groupBy?: 'status' | 'priority' | 'city' | 'debt_range'
  enabled?: boolean
}

/**
 * Hook for fetching client statistics
 *
 * @example
 * ```tsx
 * // Group by status (default)
 * const { data } = useClientStatistics({ projectId: 1 })
 *
 * // Group by priority
 * const { data } = useClientStatistics({
 *   projectId: 1,
 *   groupBy: 'priority',
 * })
 * ```
 */
export function useClientStatistics({
  projectId,
  groupBy = 'status',
  enabled = true,
}: UseClientStatisticsParams) {
  const backendParams: ClientStatisticsParams = {
    project_id: projectId,
    group_by: groupBy,
  }

  return useQuery<ClientStatisticsUI>({
    queryKey: clientStatisticsKeys.byParams(backendParams),
    queryFn: async () => {
      const data = await reportApi.getClientStatistics(backendParams)
      return transformClientStatistics(data)
    },
    enabled: enabled && !!projectId,
    staleTime: 120000, // 2 minutes (client data changes less frequently)
    refetchInterval: 600000, // Refetch every 10 minutes
    retry: 2,
  })
}

/**
 * Hook for fetching client statistics by status
 */
export function useClientStatisticsByStatus(
  projectId: number,
  enabled = true
) {
  return useClientStatistics({ projectId, groupBy: 'status', enabled })
}

/**
 * Hook for fetching client statistics by priority
 */
export function useClientStatisticsByPriority(
  projectId: number,
  enabled = true
) {
  return useClientStatistics({ projectId, groupBy: 'priority', enabled })
}

/**
 * Hook for fetching client statistics by city
 */
export function useClientStatisticsByCity(projectId: number, enabled = true) {
  return useClientStatistics({ projectId, groupBy: 'city', enabled })
}

/**
 * Hook for fetching client statistics by debt range
 */
export function useClientStatisticsByDebtRange(
  projectId: number,
  enabled = true
) {
  return useClientStatistics({ projectId, groupBy: 'debt_range', enabled })
}
