import { useQuery } from '@tanstack/react-query'
import { getHeaderKpis, getInboxQueue, getOperatorCoachingDetail } from './api'
import type { HeaderKpisFilters, OperatorDetailFilters, QueueFilters } from './types'

export const coachingKeys = {
  all: ['quality', 'coaching'] as const,
  queue: (filters: QueueFilters) => [...coachingKeys.all, 'queue', filters] as const,
  detail: (filters: OperatorDetailFilters) => [...coachingKeys.all, 'detail', filters] as const,
  headerKpis: (filters: HeaderKpisFilters) =>
    [...coachingKeys.all, 'header-kpis', filters] as const,
}

export function useInboxQueue(filters: QueueFilters, enabled = true) {
  return useQuery({
    queryKey: coachingKeys.queue(filters),
    queryFn: () => getInboxQueue(filters),
    enabled: enabled && (filters.user_ids?.length ?? 0) > 0,
    staleTime: 30_000,
  })
}

export function useOperatorCoachingDetail(filters: OperatorDetailFilters, enabled = true) {
  return useQuery({
    queryKey: coachingKeys.detail(filters),
    queryFn: () => getOperatorCoachingDetail(filters),
    enabled: enabled && Number.isFinite(filters.operator_id),
    staleTime: 30_000,
  })
}

export function useHeaderKpis(filters: HeaderKpisFilters, enabled = true) {
  return useQuery({
    queryKey: coachingKeys.headerKpis(filters),
    queryFn: () => getHeaderKpis(filters),
    enabled,
    staleTime: 30_000,
  })
}
