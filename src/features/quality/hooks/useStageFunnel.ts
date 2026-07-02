import { useQuery } from '@tanstack/react-query'
import { getStageFunnel } from '../api/qualityService'
import type { StageFunnelFilters } from '../types'

export const stageFunnelKeys = {
  all: ['quality', 'stage-funnel'] as const,
  list: (filters: StageFunnelFilters) => [...stageFunnelKeys.all, filters] as const,
}

export function useStageFunnel(filters: StageFunnelFilters, enabled = true) {
  return useQuery({
    queryKey: stageFunnelKeys.list(filters),
    queryFn: () => getStageFunnel(filters),
    enabled,
    staleTime: 30_000,
  })
}
