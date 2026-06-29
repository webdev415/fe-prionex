import { useQuery } from '@tanstack/react-query'
import { getStageFunnel } from '../api/qualityService'
import type { StageFunnelFilters } from '../types'

export const stageFunnelKeys = {
  all: ['quality', 'stage-funnel'] as const,
  list: (filters: StageFunnelFilters) => [...stageFunnelKeys.all, filters] as const,
}

/**
 * Script Stage Funnel (KAN-503) — fetches the 6-stage drop-off + pain points
 * from quality-service. The data is scorecard-derived (evaluated calls only),
 * so an empty funnel is expected until trainers score calls against the
 * "Script stages" section.
 */
export function useStageFunnel(filters: StageFunnelFilters, enabled = true) {
  return useQuery({
    queryKey: stageFunnelKeys.list(filters),
    queryFn: () => getStageFunnel(filters),
    enabled,
    staleTime: 30_000,
  })
}
