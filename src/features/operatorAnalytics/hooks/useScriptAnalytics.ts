import { useQuery } from '@tanstack/react-query'
import { getScriptAnalytics } from '../api/operatorAnalyticsService'
import type { AnalyticsRangeFilters } from '../types'

export const scriptAnalyticsKeys = {
  all: ['operator-analytics', 'script-analytics'] as const,
  list: (filters: AnalyticsRangeFilters) => [...scriptAnalyticsKeys.all, filters] as const,
}

export function useScriptAnalytics(filters: AnalyticsRangeFilters, enabled = true) {
  return useQuery({
    queryKey: scriptAnalyticsKeys.list(filters),
    queryFn: () => getScriptAnalytics(filters),
    enabled,
    staleTime: 30_000,
  })
}
