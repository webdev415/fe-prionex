import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getLeaks } from '../api/actionAnalysisService'
import type { LeakFilters } from '../types'

export const leaksKeys = {
  all: ['action-analysis', 'leaks'] as const,
  list: (filters: LeakFilters) => [...leaksKeys.all, 'list', filters] as const,
}

export function useLeaks(filters: LeakFilters, enabled = true) {
  return useQuery({
    queryKey: leaksKeys.list(filters),
    queryFn: () => getLeaks(filters),
    enabled,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  })
}
