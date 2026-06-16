import { useQuery } from '@tanstack/react-query'
import { getInteractionMonitoring } from '../api/actionAnalysisService'
import type { InteractionMonitoringFilters } from '../types'

export const interactionMonitoringKeys = {
  all: ['action-analysis', 'interactions'] as const,
  list: (filters: InteractionMonitoringFilters) =>
    [...interactionMonitoringKeys.all, 'list', filters] as const,
}

export function useInteractionMonitoring(filters: InteractionMonitoringFilters, enabled = true) {
  return useQuery({
    queryKey: interactionMonitoringKeys.list(filters),
    queryFn: () => getInteractionMonitoring(filters),
    enabled,
    staleTime: 30_000,
  })
}
