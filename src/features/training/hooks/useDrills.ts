import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  archiveDrill,
  assignDrill,
  createDrill,
  listDrills,
  scoreAttempt,
  submitAttempt,
  updateDrill,
} from '../api/drillsService'
import type { DrillCreatePayload, DrillListFilters, DrillUpdatePayload } from '../types/drills'

export const drillsKeys = {
  all: ['training', 'drills'] as const,
  list: (filters: DrillListFilters) => [...drillsKeys.all, 'list', filters] as const,
}

export function useDrills(filters: DrillListFilters = {}, enabled = true) {
  return useQuery({
    queryKey: drillsKeys.list(filters),
    queryFn: () => listDrills(filters),
    enabled,
    staleTime: 30_000,
  })
}

export function useCreateDrill() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: DrillCreatePayload) => createDrill(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: drillsKeys.all }),
  })
}

export function useUpdateDrill() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: DrillUpdatePayload }) =>
      updateDrill(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: drillsKeys.all }),
  })
}

export function useArchiveDrill() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => archiveDrill(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: drillsKeys.all }),
  })
}

export function useSubmitAttempt() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      drillId,
      payload,
    }: {
      drillId: number
      payload?: Record<string, unknown> | null
    }) => submitAttempt(drillId, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: drillsKeys.all }),
  })
}

export function useScoreAttempt() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ attemptId, score }: { attemptId: number; score: number }) =>
      scoreAttempt(attemptId, score),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: drillsKeys.all }),
  })
}

export function useAssignDrill() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ drillId, operatorIds }: { drillId: number; operatorIds: number[] }) =>
      assignDrill(drillId, operatorIds),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: drillsKeys.all }),
  })
}
