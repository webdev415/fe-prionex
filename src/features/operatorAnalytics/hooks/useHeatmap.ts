import { useQuery } from '@tanstack/react-query'
import { getHeatmap } from '../api/operatorAnalyticsService'
import type { HeatmapFilters } from '../types'

export const heatmapKeys = {
  all: ['operator-analytics', 'heatmap'] as const,
  list: (filters: HeatmapFilters) => [...heatmapKeys.all, filters] as const,
}

export function useHeatmap(filters: HeatmapFilters, enabled = true) {
  return useQuery({
    queryKey: heatmapKeys.list(filters),
    queryFn: () => getHeatmap(filters),
    enabled,
    staleTime: 30_000,
  })
}
