/**
 * React Query hooks for scoring v3 (priority) data.
 */

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { scoringApi } from '../api/scoringApi'
import type { GetV3ScoreParams } from '../api/types'

/** Feature flag: v3 UI stays hidden until the shadow-run is signed off. */
export const V3_WORKLIST_ENABLED = import.meta.env.VITE_V3_WORKLIST_ENABLED === 'true'

/** Current month as YYYY-MM-01 (the snapshot the client card/list reads). */
export function currentMonthStart(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

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

/** Per-client v3 bucket rollup for a page of clients (client card/list, KAN-791).
 * Returns a Map<client_id, {bucket_v3, priority_dollar}> for easy lookup. */
export function useV3ClientRollup(
  projectId: number | undefined,
  clientIds: number[],
  monthStart?: string,
  options: { enabled?: boolean } = {}
) {
  const ids = [...clientIds].sort((a, b) => a - b)
  return useQuery({
    queryKey: [...scoringKeys.all, 'client-rollup', projectId ?? 0, monthStart ?? null, ids],
    queryFn: () => scoringApi.getV3ClientRollup(projectId as number, clientIds, monthStart),
    enabled: !!projectId && ids.length > 0 && (options.enabled ?? true),
    staleTime: 60_000,
    select: (rows) => new Map(rows.map((r) => [r.client_id, r])),
  })
}

/** A page of clients ranked by v3 priority (bucket → priority_dollar) — KAN-791. */
export function useV3ClientOrder(
  projectId: number | undefined,
  monthStart: string,
  page: number,
  pageSize: number,
  options: { enabled?: boolean } = {}
) {
  return useQuery({
    queryKey: [...scoringKeys.all, 'client-order', projectId ?? 0, monthStart, page, pageSize],
    queryFn: () =>
      scoringApi.getV3ClientOrder(projectId as number, monthStart, pageSize, page * pageSize),
    enabled: !!projectId && (options.enabled ?? true),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })
}

/** Trigger a re-score. Scoring runs in the background (Celery), so results
 * appear after the job finishes — we refresh the list shortly after. */
export function useTriggerV3Scoring() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { projectId: number; asOf?: string }) =>
      scoringApi.triggerV3Scoring(vars.projectId, vars.asOf),
    onSuccess: () => {
      toast.success('Scoring started — refresh in a moment to see updates.')
      setTimeout(() => qc.invalidateQueries({ queryKey: scoringKeys.lists() }), 4000)
    },
    onError: () => toast.error('Could not start scoring.'),
  })
}
