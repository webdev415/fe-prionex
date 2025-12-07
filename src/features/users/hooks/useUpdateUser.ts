/**
 * useUpdateUser Hook
 *
 * React Query mutation hook for updating user fields.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { usersApi } from '../api/usersApi'
import { usersKeys } from './useUsers'
import { rolesKeys } from '@/features/roles/hooks/useRoles'
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

  return useMutation({
    mutationFn: ({ userId, data }: { userId: number; data: UpdateUserInput }) =>
      usersApi.updateUser(userId, data),
    onSuccess: (_, variables) => {
      // Invalidate specific user detail
      queryClient.invalidateQueries({ queryKey: usersKeys.detail(variables.userId) })
      // Invalidate users list
      queryClient.invalidateQueries({ queryKey: usersKeys.lists() })
      // Invalidate roles list to update user_count for roles (if role assignment changed)
      queryClient.invalidateQueries({ queryKey: rolesKeys.lists() })
      // Invalidate all role detail queries (including users) to update role user lists
      queryClient.invalidateQueries({ queryKey: rolesKeys.details() })
    },
  })
}
