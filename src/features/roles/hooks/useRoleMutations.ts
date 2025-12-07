/**
 * Role Mutation Hooks
 *
 * React Query mutation hooks for role CRUD operations.
 */

import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { rolesApi } from '../api/rolesApi'
import { rolesKeys } from './useRoles'
import type { CreateRoleInput, UpdateRoleInput } from '../types'

/**
 * Hook to fetch all available permissions
 */
export function usePermissions() {
  return useQuery({
    queryKey: rolesKeys.permissions(),
    queryFn: () => rolesApi.getPermissions(),
  })
}

/**
 * Hook to create a new role
 */
export function useCreateRole() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateRoleInput) => rolesApi.createRole(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rolesKeys.lists() })
    },
  })
}

/**
 * Hook to update an existing role
 */
export function useUpdateRole() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ roleId, data }: { roleId: number; data: UpdateRoleInput }) =>
      rolesApi.updateRole(roleId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: rolesKeys.detail(variables.roleId) })
      queryClient.invalidateQueries({ queryKey: rolesKeys.lists() })
    },
  })
}

/**
 * Hook to delete a role
 */
export function useDeleteRole() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ roleId }: { roleId: number }) => rolesApi.deleteRole(roleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rolesKeys.lists() })
    },
  })
}
