/**
 * Group Mutation Hooks
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { groupsApi } from '../api/groupsApi'
import { groupsKeys } from './useGroups'
import { getErrorMessage } from '@/lib/errors'
import type { CreateGroupInput, UpdateGroupInput } from '../types'

export function useCreateGroup() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateGroupInput) => groupsApi.createGroup(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groupsKeys.lists() })
    },
    onError: (error) => {
      toast.error(getErrorMessage(error))
    },
  })
}

export function useUpdateGroup() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateGroupInput }) =>
      groupsApi.updateGroup(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: groupsKeys.detail(variables.id) })
      queryClient.invalidateQueries({ queryKey: groupsKeys.lists() })
    },
    onError: (error) => {
      toast.error(getErrorMessage(error))
    },
  })
}

export function useArchiveGroup() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id }: { id: number }) => groupsApi.archiveGroup(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groupsKeys.lists() })
    },
    onError: (error) => {
      toast.error(getErrorMessage(error))
    },
  })
}
