import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createCorrectionTask,
  getCorrectionStats,
  listCorrectionTasks,
  transitionCorrectionTask,
  type GetStatsFilters,
} from '../api/correctionTaskService'
import type {
  CorrectionTaskCreatePayload,
  CorrectionTaskListFilters,
  CorrectionTransitionPayload,
} from '../types/correction'

export const correctionKeys = {
  all: ['training', 'correction'] as const,
  list: (filters: CorrectionTaskListFilters) =>
    [...correctionKeys.all, 'list', filters] as const,
  stats: (filters: GetStatsFilters) => [...correctionKeys.all, 'stats', filters] as const,
}

export function useCorrectionTasks(
  filters: CorrectionTaskListFilters = {},
  enabled = true
) {
  return useQuery({
    queryKey: correctionKeys.list(filters),
    queryFn: () => listCorrectionTasks(filters),
    enabled,
    staleTime: 30_000,
  })
}

export function useCorrectionStats(filters: GetStatsFilters, enabled = true) {
  return useQuery({
    queryKey: correctionKeys.stats(filters),
    queryFn: () => getCorrectionStats(filters),
    enabled,
    staleTime: 60_000,
  })
}

export function useCreateCorrectionTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CorrectionTaskCreatePayload) => createCorrectionTask(payload),
    onSuccess: () => {
      // List + composite-score header KPI all reflect new tasks.
      queryClient.invalidateQueries({ queryKey: correctionKeys.all })
      queryClient.invalidateQueries({ queryKey: ['quality', 'coaching'] })
    },
  })
}

export function useTransitionCorrectionTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      taskId,
      payload,
    }: {
      taskId: number
      payload: CorrectionTransitionPayload
    }) => transitionCorrectionTask(taskId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: correctionKeys.all })
      queryClient.invalidateQueries({ queryKey: ['quality', 'coaching'] })
    },
  })
}
