/**
 * Department Mutation Hooks
 *
 * React Query mutation hooks for department CRUD operations.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { departmentsApi } from '../api/departmentsApi'
import { departmentsKeys } from './useDepartments'
import { getErrorMessage } from '@/lib/errors'
import type { CreateDepartmentInput, UpdateDepartmentInput } from '../types'

/**
 * Hook to create a new department
 */
export function useCreateDepartment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateDepartmentInput) => departmentsApi.createDepartment(data),
    onSuccess: () => {
      toast.success('Department created successfully')
      queryClient.invalidateQueries({ queryKey: departmentsKeys.lists() })
    },
    onError: (error) => {
      toast.error(getErrorMessage(error))
    },
  })
}

/**
 * Hook to update an existing department
 */
export function useUpdateDepartment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateDepartmentInput }) =>
      departmentsApi.updateDepartment(id, data),
    onSuccess: (_, variables) => {
      toast.success('Department updated successfully')
      queryClient.invalidateQueries({ queryKey: departmentsKeys.detail(variables.id) })
      queryClient.invalidateQueries({ queryKey: departmentsKeys.lists() })
    },
    onError: (error) => {
      toast.error(getErrorMessage(error))
    },
  })
}

/**
 * Hook to archive (soft delete) a department
 */
export function useArchiveDepartment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id }: { id: number }) => departmentsApi.archiveDepartment(id),
    onSuccess: () => {
      toast.success('Department archived successfully')
      queryClient.invalidateQueries({ queryKey: departmentsKeys.lists() })
    },
    onError: (error) => {
      toast.error(getErrorMessage(error))
    },
  })
}
