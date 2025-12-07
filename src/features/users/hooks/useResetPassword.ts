/**
 * useResetPassword Hook
 *
 * React Query mutation hook for resetting user password.
 * Returns a temporary password that must be provided to the user.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { usersApi } from '../api/usersApi'
import { usersKeys } from './useUsers'

/**
 * Reset user password
 *
 * Generates a temporary password and forces user to change it on next login.
 *
 * @returns React Query mutation result with temporary password
 *
 * @example
 * ```tsx
 * const { mutate, data } = useResetPassword()
 *
 * const handleReset = (userId: number) => {
 *   mutate(userId, {
 *     onSuccess: (data) => {
 *       alert(`Temporary password: ${data.temporary_password}`)
 *     },
 *   })
 * }
 * ```
 */
export function useResetPassword() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (userId: number) => usersApi.resetPassword(userId),
    onSuccess: (_, userId) => {
      queryClient.invalidateQueries({ queryKey: usersKeys.detail(userId) })
    },
  })
}
