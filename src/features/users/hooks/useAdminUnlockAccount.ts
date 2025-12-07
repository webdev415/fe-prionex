/**
 * useAdminUnlockAccount Hook
 *
 * React Query mutation hook for unlocking an account by user ID
 * using the /api/v1/admin/users/{user_id}/unlock endpoint.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { usersApi } from '../api/usersApi'
import { usersKeys } from './useUsers'

interface AdminUnlockVariables {
  userId: number
  username: string
}

export function useAdminUnlockAccount() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ userId }: AdminUnlockVariables) => usersApi.unlockAccount(userId),
    onSuccess: (_, variables) => {
      // Refresh user detail and list after successful unlock
      queryClient.invalidateQueries({ queryKey: usersKeys.detail(variables.userId) })
      queryClient.invalidateQueries({ queryKey: usersKeys.lists() })
    },
  })
}
