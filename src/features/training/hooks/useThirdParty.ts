import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getThirdParty } from '../api/actionAnalysisService'
import type { ThirdPartyFilters } from '../types'

export const thirdPartyKeys = {
  all: ['action-analysis', 'third-parties'] as const,
  list: (filters: ThirdPartyFilters) => [...thirdPartyKeys.all, 'list', filters] as const,
}

export function useThirdParty(filters: ThirdPartyFilters, enabled = true) {
  return useQuery({
    queryKey: thirdPartyKeys.list(filters),
    queryFn: () => getThirdParty(filters),
    enabled,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  })
}
