/**
 * useRoles Hook
 *
 * React Query hook for fetching paginated roles list.
 */

import { useQuery } from '@tanstack/react-query'
import { rolesApi } from '../api/rolesApi'
import type { RoleListParams } from '../types'

/**
 * Query key factory for roles
 */
export const rolesKeys = {
  all: ['roles'] as const,
  lists: () => [...rolesKeys.all, 'list'] as const,
  list: (params: RoleListParams) => [...rolesKeys.lists(), params] as const,
  details: () => [...rolesKeys.all, 'detail'] as const,
  detail: (id: number) => [...rolesKeys.details(), id] as const,
  permissions: () => [...rolesKeys.all, 'permissions'] as const,
}

/**
 * Hook to fetch roles list
 */
export function useRoles(params: RoleListParams = {}) {
  return useQuery({
    queryKey: rolesKeys.list(params),
    queryFn: () => rolesApi.getRoles(params),
  })
}
