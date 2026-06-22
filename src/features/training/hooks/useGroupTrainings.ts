import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  cancelGroupTraining,
  createGroupTraining,
  listGroupTrainings,
  registerForTraining,
  unregisterFromTraining,
  updateGroupTraining,
} from '../api/groupTrainingsService'
import type {
  GroupTrainingCreatePayload,
  GroupTrainingListFilters,
  GroupTrainingUpdatePayload,
} from '../types/groupTrainings'

export const groupTrainingsKeys = {
  all: ['training', 'group-trainings'] as const,
  list: (filters: GroupTrainingListFilters) =>
    [...groupTrainingsKeys.all, 'list', filters] as const,
}

export function useGroupTrainings(filters: GroupTrainingListFilters = {}, enabled = true) {
  return useQuery({
    queryKey: groupTrainingsKeys.list(filters),
    queryFn: () => listGroupTrainings(filters),
    enabled,
    staleTime: 30_000,
  })
}

export function useCreateGroupTraining() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: GroupTrainingCreatePayload) => createGroupTraining(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: groupTrainingsKeys.all }),
  })
}

export function useUpdateGroupTraining() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: GroupTrainingUpdatePayload }) =>
      updateGroupTraining(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: groupTrainingsKeys.all }),
  })
}

export function useCancelGroupTraining() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => cancelGroupTraining(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: groupTrainingsKeys.all }),
  })
}

export function useRegisterForTraining() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => registerForTraining(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: groupTrainingsKeys.all }),
  })
}

export function useUnregisterFromTraining() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => unregisterFromTraining(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: groupTrainingsKeys.all }),
  })
}
