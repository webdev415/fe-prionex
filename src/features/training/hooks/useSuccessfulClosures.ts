import { useQuery } from '@tanstack/react-query'
import { getSuccessfulClosures } from '../api/actionAnalysisService'
import type { ClosureFilters } from '../types'

export const successfulClosuresKeys = {
  all: ['action-analysis', 'successful-closures'] as const,
  list: (filters: ClosureFilters) => [...successfulClosuresKeys.all, 'list', filters] as const,
}

export function useSuccessfulClosures(filters: ClosureFilters, enabled = true) {
  return useQuery({
    queryKey: successfulClosuresKeys.list(filters),
    queryFn: () => getSuccessfulClosures(filters),
    enabled,
    staleTime: 30_000,
  })
}
