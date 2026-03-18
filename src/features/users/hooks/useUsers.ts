/**
 * useUsers Hook
 *
 * React Query hook for fetching paginated users list.
 */

import { useQuery } from '@tanstack/react-query'
import { usersApi } from '../api/usersApi'
import type { UserListParams } from '../types'

/**
 * Query key factory for users queries
 */
export const usersKeys = {
  all: ['users'] as const,
  lists: () => [...usersKeys.all, 'list'] as const,
  list: (params: UserListParams) => [...usersKeys.lists(), params] as const,
  details: () => [...usersKeys.all, 'detail'] as const,
  detail: (id: number) => [...usersKeys.details(), id] as const,
}

/**
 * Fetch paginated users list
 *
 * @param params - Query parameters for filtering and pagination
 * @returns React Query result with users data
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = useUsers({ page: 1, status: 'active' })
 * ```
 */
export function useUsers(params: UserListParams = {}) {
  return useQuery({
    queryKey: usersKeys.list(params),
    queryFn: () => usersApi.getUsers(params),
  })
}

/**
 * Fetch active operators for a project — accessible to ALL users (not admin-only).
 * Use this for any dropdown that non-admin users can see.
 */
export function useOperators(projectId: number | null | undefined) {
  return useQuery({
    queryKey: ['users', 'operators', projectId],
    queryFn: () => usersApi.getOperators(projectId!),
    enabled: !!projectId,
    staleTime: 2 * 60_000,
    select: (data) => data.operators,
  })
}
