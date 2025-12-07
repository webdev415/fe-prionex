/**
 * usePermissions Hook
 *
 * React Query hook for fetching available permissions.
 */

import { useQuery } from '@tanstack/react-query'
import { rolesApi } from '../api/rolesApi'

/**
 * Query key factory for permissions
 */
export const permissionsKeys = {
  all: ['permissions'] as const,
}

/**
 * Hook to fetch all available permissions
 */
export function usePermissions() {
  return useQuery({
    queryKey: permissionsKeys.all,
    queryFn: () => rolesApi.getPermissions(),
  })
}
