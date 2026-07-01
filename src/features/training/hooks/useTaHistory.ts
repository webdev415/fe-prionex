import { useQuery } from '@tanstack/react-query'
import { getTaHistory } from '../api/actionAnalysisService'
import type { TAInteractionListParams } from '@/features/taInteractions/api/types'

export const taHistoryKeys = {
  all: ['action-analysis', 'ta-history'] as const,
  list: (filters: TAInteractionListParams) => [...taHistoryKeys.all, 'list', filters] as const,
}

export function useTaHistory(filters: TAInteractionListParams, enabled = true) {
  return useQuery({
    queryKey: taHistoryKeys.list(filters),
    queryFn: () => getTaHistory(filters),
    enabled,
    staleTime: 30_000,
  })
}
