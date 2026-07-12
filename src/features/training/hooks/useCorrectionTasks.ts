import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createCorrectionTask,
  getCorrectionStats,
  getCorrectionTaskByFeedback,
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
  list: (filters: CorrectionTaskListFilters) => [...correctionKeys.all, 'list', filters] as const,
  stats: (filters: GetStatsFilters) => [...correctionKeys.all, 'stats', filters] as const,
  byFeedback: (feedbackId: number) => [...correctionKeys.all, 'by-feedback', feedbackId] as const,
}

export function useCorrectionTasks(filters: CorrectionTaskListFilters = {}, enabled = true) {
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

export function useCorrectionTaskByFeedback(feedbackId: number | null, enabled = true) {
  return useQuery({
    queryKey:
      feedbackId == null
        ? [...correctionKeys.all, 'by-feedback', 'pending']
        : correctionKeys.byFeedback(feedbackId),
    queryFn: () => getCorrectionTaskByFeedback(feedbackId as number),
    enabled: enabled && feedbackId != null,
    staleTime: 10_000,
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
    mutationFn: ({ taskId, payload }: { taskId: number; payload: CorrectionTransitionPayload }) =>
      transitionCorrectionTask(taskId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: correctionKeys.all })
      queryClient.invalidateQueries({ queryKey: ['quality', 'coaching'] })
    },
  })
}
