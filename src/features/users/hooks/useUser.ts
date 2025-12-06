/**
 * useUser Hook
 *
 * React Query hook for fetching single user detail with project assignments.
 */

import { useQuery } from '@tanstack/react-query'
import { usersApi } from '../api/usersApi'
import { usersKeys } from './useUsers'

/**
 * Fetch single user detail by ID
 *
 * @param userId - User ID to fetch
 * @returns React Query result with user detail data
 *
 * @example
 * ```tsx
 * const { data: user, isLoading } = useUser(1)
 * ```
 */
export function useUser(userId: number | undefined | null) {
  return useQuery({
    queryKey: usersKeys.detail(userId as number),
    queryFn: () => usersApi.getUser(userId as number),
    enabled: !!userId && userId > 0,
  })
}
