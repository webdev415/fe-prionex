/**
 * useUpdateUser Hook
 *
 * React Query mutation hook for updating user fields.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { usersApi } from '../api/usersApi'
import { usersKeys } from './useUsers'
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
    },
  })
}
