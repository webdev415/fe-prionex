/**
 * useUnlockAccount Hook
 *
 * React Query mutation hook for unlocking a locked user account.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { usersApi } from '../api/usersApi'
import { usersKeys } from './useUsers'
import { getErrorMessage } from '@/lib/errors'

/**
 * Unlock user account after lockout
 *
 * @returns React Query mutation result
 *
 * @example
 * ```tsx
 * const { mutate, isLoading } = useUnlockAccount()
 *
 * const handleUnlock = (userId: number) => {
 *   mutate(userId, {
 *     onSuccess: () => {
 *       toast.success('Account unlocked successfully')
 *     },
 *   })
 * }
 * ```
 */
export function useUnlockAccount() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (userId: number) => usersApi.unlockAccount(userId),
    onSuccess: (_, userId) => {
      toast.success('Account unlocked successfully')
      queryClient.invalidateQueries({ queryKey: usersKeys.detail(userId) })
      queryClient.invalidateQueries({ queryKey: usersKeys.lists() })
    },
    onError: (error) => {
      toast.error(getErrorMessage(error))
    },
  })
}
