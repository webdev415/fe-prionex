import { useQuery } from '@tanstack/react-query'
import { getScreenTime } from '../api/operatorAnalyticsService'
import type { AnalyticsRangeFilters } from '../types'

export const screenTimeKeys = {
  all: ['operator-analytics', 'screen-time'] as const,
  list: (filters: AnalyticsRangeFilters) => [...screenTimeKeys.all, filters] as const,
}

export function useScreenTime(filters: AnalyticsRangeFilters, enabled = true) {
  return useQuery({
    queryKey: screenTimeKeys.list(filters),
    queryFn: () => getScreenTime(filters),
    enabled,
    staleTime: 30_000,
  })
}
