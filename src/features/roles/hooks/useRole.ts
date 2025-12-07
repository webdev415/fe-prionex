/**
 * useRole Hook
 *
 * React Query hook for fetching a single role.
 */

import { useQuery } from '@tanstack/react-query'
import { rolesApi } from '../api/rolesApi'
import { rolesKeys } from './useRoles'

/**
 * Hook to fetch a single role by ID
 */
export function useRole(roleId: number) {
  return useQuery({
    queryKey: rolesKeys.detail(roleId),
    queryFn: () => rolesApi.getRole(roleId),
    enabled: !!roleId && roleId > 0,
  })
}
