/**
 * useReactivateUser Hook
 *
 * React Query mutation hook for reactivating a deactivated user account.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { usersApi } from '../api/usersApi'
import { usersKeys } from './useUsers'

/**
 * Reactivate user account
 *
 * @returns React Query mutation result
 *
 * @example
 * ```tsx
 * const { mutate, isLoading } = useReactivateUser()
 *
 * const handleReactivate = (userId: number) => {
 *   mutate(userId, {
 *     onSuccess: () => {
 *       toast.success('User reactivated successfully')
 *     },
 *   })
 * }
 * ```
 */
export function useReactivateUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (userId: number) => usersApi.reactivateUser(userId),
    onSuccess: (_, userId) => {
      queryClient.invalidateQueries({ queryKey: usersKeys.detail(userId) })
      queryClient.invalidateQueries({ queryKey: usersKeys.lists() })
    },
  })
}
