/**
 * Dashboard Hook
 *
 * React Query hook for fetching and caching dashboard data.
 */

import { useQuery } from '@tanstack/react-query'
import { reportApi } from '../api/reportApi'
import type { DashboardParams } from '../api/types'
import { transformDashboard, mapPeriodToBackend } from '../utils/transformers'
import type { Period, DashboardUI } from '../types'

/**
 * Query keys for dashboard
 */
export const dashboardKeys = {
  all: ['reports', 'dashboard'] as const,
  byProject: (projectId: number) => [...dashboardKeys.all, projectId] as const,
  byParams: (params: DashboardParams) => [...dashboardKeys.all, params] as const,
}

/**
 * Dashboard hook params (frontend format)
 */
export interface UseDashboardParams {
  projectId: number
  period?: Period
  startDate?: string
  endDate?: string
  timezone?: string | null
  enabled?: boolean
}

/**
 * Hook for fetching dashboard data
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = useDashboard({
 *   projectId: 1,
 *   period: 'today',
 * })
 * ```
 */
export function useDashboard({
  projectId,
  period = 'today',
  startDate,
  endDate,
  timezone,
  enabled = true,
}: UseDashboardParams) {
  // Convert frontend params to backend format
  const backendParams: DashboardParams = {
    project_id: projectId,
    period: mapPeriodToBackend(period),
    start_date: startDate,
    end_date: endDate,
    user_timezone: timezone,
  }

  return useQuery<DashboardUI>({
    queryKey: dashboardKeys.byParams(backendParams),
    queryFn: async () => {
      const data = await reportApi.getDashboard(backendParams)
      return transformDashboard(data)
    },
    enabled: enabled && !!projectId,
    staleTime: 0, // Always fetch fresh data
    refetchOnMount: 'always', // Always refetch when component mounts
    refetchOnWindowFocus: true,
    refetchInterval: 3000, // Refetch every 3 seconds for real-time updates
    retry: 2,
  })
}

/**
 * Hook for prefetching dashboard data
 * Use this to prefetch data before navigation
 */
export function usePrefetchDashboard() {
  const queryClient = useQuery({
    queryKey: ['prefetch-helper'],
    queryFn: () => null,
    enabled: false,
  })

  return {
    prefetch: async (_params: UseDashboardParams) => {
      // Note: Prefetch implementation would use _params to prepare query
      await queryClient.refetch()
    },
  }
}
