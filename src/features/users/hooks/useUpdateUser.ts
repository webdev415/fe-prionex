/**
 * useUpdateUser Hook
 *
 * React Query mutation hook for updating user fields.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { usersApi } from '../api/usersApi'
import { usersKeys } from './useUsers'
import { rolesKeys } from '@/features/roles/hooks/useRoles'
import { getErrorMessage } from '@/lib/errors'
import { useAuthStore } from '@/stores/authStore'
import type { UpdateUserInput } from '../types'

/**
 * Update existing user
 *
 * @returns React Query mutation result
 *
 * @example
 * ```tsx
 * const { mutate, isLoading } = useUpdateUser()
 *
 * const handleSubmit = (data: UpdateUserInput) => {
 *   mutate({ userId: 1, data }, {
 *     onSuccess: () => {
 *       toast.success('User updated successfully')
 *     },
 *   })
 * }
 * ```
 */
export function useUpdateUser() {
  const queryClient = useQueryClient()
  const currentUser = useAuthStore((state) => state.user)
  const refreshUser = useAuthStore((state) => state.refreshUser)

  return useMutation({
    mutationFn: ({ userId, data }: { userId: number; data: UpdateUserInput }) =>
      usersApi.updateUser(userId, data),
    onSuccess: (_, variables) => {
      toast.success('User updated successfully')
      // Invalidate specific user detail
      queryClient.invalidateQueries({ queryKey: usersKeys.detail(variables.userId) })
      // Invalidate users list
      queryClient.invalidateQueries({ queryKey: usersKeys.lists() })
      // Invalidate roles list to update user_count for roles (if role assignment changed)
      queryClient.invalidateQueries({ queryKey: rolesKeys.lists() })
      // Invalidate all role detail queries (including users) to update role user lists
      queryClient.invalidateQueries({ queryKey: rolesKeys.details() })
      // If the updated user is the current user, refresh the auth store
      if (currentUser && String(variables.userId) === currentUser.id) {
        refreshUser()
      }
    },
    onError: (error) => {
      toast.error(getErrorMessage(error))
    },
  })
}
