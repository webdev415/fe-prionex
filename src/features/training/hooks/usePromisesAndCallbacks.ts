import { useQuery } from '@tanstack/react-query'
import { getPromisesAndCallbacks } from '../api/actionAnalysisService'
import type { PromiseCallbackFilters } from '../types'

export const promisesAndCallbacksKeys = {
  all: ['action-analysis', 'promises-and-callbacks'] as const,
  list: (filters: PromiseCallbackFilters) =>
    [...promisesAndCallbacksKeys.all, 'list', filters] as const,
}

export function usePromisesAndCallbacks(filters: PromiseCallbackFilters, enabled = true) {
  return useQuery({
    queryKey: promisesAndCallbacksKeys.list(filters),
    queryFn: () => getPromisesAndCallbacks(filters),
    enabled,
    staleTime: 30_000,
  })
}
