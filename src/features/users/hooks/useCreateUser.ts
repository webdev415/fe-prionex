/**
 * useCreateUser Hook
 *
 * React Query mutation hook for creating a new user.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { usersApi } from '../api/usersApi'
import { usersKeys } from './useUsers'
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
 *       toast.success('User created successfully')
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
      // Invalidate users list to refetch with new user
      queryClient.invalidateQueries({ queryKey: usersKeys.lists() })
    },
  })
}
