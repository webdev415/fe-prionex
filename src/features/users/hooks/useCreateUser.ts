/**
 * useCreateUser Hook
 *
 * React Query mutation hook for creating a new user.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import i18n from '@/lib/i18n'
import { usersApi } from '../api/usersApi'
import { usersKeys } from './useUsers'
import { rolesKeys } from '@/features/roles/hooks/useRoles'
import { getErrorMessage } from '@/lib/errors'
import type { CreateUserInput } from '../types'

/**
 * Create a new user
 *
 * @returns React Query mutation result
 *
 * @example
 * ```tsx
 * const { mutate, isLoading } = useCreateUser()
 *
 * const handleSubmit = (data: CreateUserInput) => {
 *   mutate(data, {
 *     onSuccess: () => {
 *       toast.success(i18n.t('toasts.users.created', { defaultValue: 'User created successfully' }))
 *     },
 *   })
 * }
 * ```
 */
export function useCreateUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateUserInput) => usersApi.createUser(input),
    onSuccess: () => {
      toast.success(i18n.t('toasts.users.created', { defaultValue: 'User created successfully' }))
      // Invalidate users list to refetch with new user
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
