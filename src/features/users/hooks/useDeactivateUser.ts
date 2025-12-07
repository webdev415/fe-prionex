/**
 * useDeactivateUser Hook
 *
 * React Query mutation hook for deactivating a user account.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { usersApi } from '../api/usersApi'
import { usersKeys } from './useUsers'
import { rolesKeys } from '@/features/roles/hooks/useRoles'

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
      // Invalidate roles list to update user_count for roles
      queryClient.invalidateQueries({ queryKey: rolesKeys.lists() })
      // Invalidate all role detail queries (including users) to update role user lists
      queryClient.invalidateQueries({ queryKey: rolesKeys.details() })
    },
  })
}
