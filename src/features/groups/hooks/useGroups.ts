/**
 * useGroups Hook
 */

import { useQuery } from '@tanstack/react-query'
import { groupsApi } from '../api/groupsApi'
import type { GroupFilters } from '../types'

export const groupsKeys = {
  all: ['groups'] as const,
  lists: () => [...groupsKeys.all, 'list'] as const,
  list: (filters: GroupFilters) => [...groupsKeys.lists(), filters] as const,
  details: () => [...groupsKeys.all, 'detail'] as const,
  detail: (id: number) => [...groupsKeys.details(), id] as const,
}

export function useGroups(filters: GroupFilters = {}, enabled = true) {
  return useQuery({
    queryKey: groupsKeys.list(filters),
    queryFn: () => groupsApi.getGroups(filters),
    enabled,
  })
}

export function useGroup(id: number) {
  return useQuery({
    queryKey: groupsKeys.detail(id),
    queryFn: () => groupsApi.getGroup(id),
    enabled: !!id && id > 0,
  })
}
