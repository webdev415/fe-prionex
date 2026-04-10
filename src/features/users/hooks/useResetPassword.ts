/**
 * useResetPassword Hook
 *
 * Admin-only mutation: sets user password to the system default (server-side).
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { usersApi } from '../api/usersApi'
import { usersKeys } from './useUsers'

/**
 * @returns React Query mutation; response includes default password value for disclosure to the user
 */
export function useResetPassword() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (userId: number) => usersApi.resetPassword(userId),
    onSuccess: (_, userId) => {
      queryClient.invalidateQueries({ queryKey: usersKeys.detail(userId) })
      queryClient.invalidateQueries({ queryKey: usersKeys.lists() })
    },
  })
}
