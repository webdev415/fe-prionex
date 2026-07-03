import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  archiveDrill,
  assignDrill,
  createDrill,
  getDrillStats,
  listDrillAttempts,
  listDrills,
  transitionAttempt,
  updateDrill,
} from '../api/drillsService'
import type {
  AssignDrillPayload,
  AttemptTransitionPayload,
  DrillCreatePayload,
  DrillListFilters,
  DrillUpdatePayload,
} from '../types/drills'

export const drillsKeys = {
  all: ['training', 'drills'] as const,
  list: (filters: DrillListFilters) => [...drillsKeys.all, 'list', filters] as const,
  attempts: (drillId: number) => [...drillsKeys.all, 'attempts', drillId] as const,
  stats: (drillId: number) => [...drillsKeys.all, 'stats', drillId] as const,
}

export function useDrills(filters: DrillListFilters = {}, enabled = true) {
  return useQuery({
    queryKey: drillsKeys.list(filters),
    queryFn: () => listDrills(filters),
    enabled,
    staleTime: 30_000,
  })
}

export function useDrillAttempts(drillId: number | null) {
  return useQuery({
    queryKey: drillsKeys.attempts(drillId ?? 0),
    queryFn: () => listDrillAttempts(drillId as number),
    enabled: drillId != null,
    staleTime: 15_000,
  })
}

export function useDrillStats(drillId: number | null) {
  return useQuery({
    queryKey: drillsKeys.stats(drillId ?? 0),
    queryFn: () => getDrillStats(drillId as number),
    enabled: drillId != null,
    staleTime: 15_000,
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

export function useAssignDrill() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ drillId, payload }: { drillId: number; payload: AssignDrillPayload }) =>
      assignDrill(drillId, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: drillsKeys.all }),
  })
}

export function useTransitionAttempt() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      attemptId,
      payload,
    }: {
      attemptId: number
      payload: AttemptTransitionPayload
    }) => transitionAttempt(attemptId, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: drillsKeys.all }),
  })
}
