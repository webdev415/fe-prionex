/**
 * useDeactivateUser Hook
 *
 * React Query mutation hook for deactivating a user account.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { usersApi } from '../api/usersApi'
import { usersKeys } from './useUsers'

/**
 * Deactivate user account
 *
 * @returns React Query mutation result
 *
 * @example
 * ```tsx
 * const { mutate, isLoading } = useDeactivateUser()
 *
 * const handleDeactivate = (userId: number) => {
 *   mutate(userId, {
 *     onSuccess: () => {
 *       toast.success('User deactivated successfully')
 *     },
 *   })
 * }
 * ```
 */
export function useDeactivateUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (userId: number) => usersApi.deactivateUser(userId),
    onSuccess: (_, userId) => {
      queryClient.invalidateQueries({ queryKey: usersKeys.detail(userId) })
      queryClient.invalidateQueries({ queryKey: usersKeys.lists() })
    },
  })
}
