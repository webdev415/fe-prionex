/**
 * useReactivateUser Hook
 *
 * React Query mutation hook for reactivating a deactivated user account.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { usersApi } from '../api/usersApi'
import { usersKeys } from './useUsers'
import { rolesKeys } from '@/features/roles/hooks/useRoles'
import { getErrorMessage } from '@/lib/errors'

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
      toast.success('User reactivated successfully')
      queryClient.invalidateQueries({ queryKey: usersKeys.detail(userId) })
      queryClient.invalidateQueries({ queryKey: usersKeys.lists() })
      // Invalidate roles list to update user_count for roles
      queryClient.invalidateQueries({ queryKey: rolesKeys.lists() })
      // Invalidate all role detail queries (including users) to update role user lists
      queryClient.invalidateQueries({ queryKey: rolesKeys.details() })
    },
    onError: (error) => {
      toast.error(getErrorMessage(error))
    },
  })
}
