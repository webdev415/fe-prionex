/**
 * React Query hooks for scoring v3 (priority) data.
 */

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { scoringApi } from '../api/scoringApi'
import type { GetV3ScoreParams } from '../api/types'

export const scoringKeys = {
  all: ['v3-scoring'] as const,
  lists: () => [...scoringKeys.all, 'list'] as const,
  list: (projectId: number, params: GetV3ScoreParams) =>
    [...scoringKeys.lists(), projectId, params] as const,
  monitoring: (projectId: number, month?: string) =>
    [...scoringKeys.all, 'monitoring', projectId, month ?? null] as const,
}

export function useV3Scores(
  projectId: number | undefined,
  params: GetV3ScoreParams = {},
  options: { enabled?: boolean } = {}
) {
  return useQuery({
    queryKey: scoringKeys.list(projectId ?? 0, params),
    queryFn: () => scoringApi.getV3Scores(projectId as number, params),
    enabled: !!projectId && (options.enabled ?? true),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })
}

export function useV3Monitoring(
  projectId: number | undefined,
  month?: string,
  options: { enabled?: boolean } = {}
) {
  return useQuery({
    queryKey: scoringKeys.monitoring(projectId ?? 0, month),
    queryFn: () => scoringApi.getV3Monitoring(projectId as number, month),
    enabled: !!projectId && (options.enabled ?? true),
  })
}
