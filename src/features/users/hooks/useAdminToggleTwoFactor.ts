/**
 * useAdminDisableTwoFactor / useAdminReenableTwoFactor Hooks
 *
 * Admin-only mutations to soft-disable or re-enable a user's 2FA.
 * The TOTP secret and unused backup codes survive a disable so the
 * admin can flip 2FA back on later without forcing re-enrollment.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { usersApi } from '../api/usersApi'
import { usersKeys } from './useUsers'

export function useAdminDisableTwoFactor() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (userId: number) => usersApi.adminDisableTwoFactor(userId),
    onSuccess: (_, userId) => {
      queryClient.invalidateQueries({ queryKey: usersKeys.detail(userId) })
      queryClient.invalidateQueries({ queryKey: usersKeys.lists() })
    },
  })
}

export function useAdminReenableTwoFactor() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (userId: number) => usersApi.adminReenableTwoFactor(userId),
    onSuccess: (_, userId) => {
      queryClient.invalidateQueries({ queryKey: usersKeys.detail(userId) })
      queryClient.invalidateQueries({ queryKey: usersKeys.lists() })
    },
  })
}
