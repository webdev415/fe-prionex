/**
 * React Query hooks for scoring v3 (priority) data.
 */

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import i18n from '@/lib/i18n'
import { useAuthStore } from '@/stores/authStore'
import { scoringApi } from '../api/scoringApi'
import type { GetV3ScoreParams, V3Settings } from '../api/types'

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
  uiEnabled: (projectId: number) => [...scoringKeys.all, 'ui-enabled', projectId] as const,
}

/** Active project id as a number (the "brand" v3 is scoped to). */
export function useActiveProjectId(): number | undefined {
  const raw = useAuthStore((s) => s.user?.active_project_id)
  return raw ? Number(raw) : undefined
}

/**
 * Is the v3 operator UI live for the CURRENT brand? (KAN-791, gated by KAN-794.)
 *
 * Replaces the old build-time `VITE_V3_WORKLIST_ENABLED`, which was global: one
 * rebuild flipped v3 on for every brand, including ones with no shadow-run
 * sign-off. This reads the per-brand switch instead, so cutover is a per-brand
 * ops decision (audited) and rollback is flipping it back — no deploy either way.
 *
 * Returns false while loading and on any error: an unsigned-off brand must never
 * see v3 because a request was slow or the config service was down.
 */
export function useV3UiEnabled(): boolean {
  return useV3UiEnabledState().enabled
}

/**
 * Same switch, with the loading flag — for route guards, which must not redirect
 * on the first render just because the answer has not arrived yet.
 */
export function useV3UiEnabledState(): { enabled: boolean; isLoading: boolean } {
  const projectId = useActiveProjectId()
  const { data, isLoading } = useQuery({
    queryKey: scoringKeys.uiEnabled(projectId ?? 0),
    queryFn: () => scoringApi.getV3UiEnabled(projectId as number),
    enabled: !!projectId,
    staleTime: 5 * 60_000, // cutover is a rare, deliberate event
    retry: 1,
  })
  return { enabled: data?.enabled ?? false, isLoading: isLoading && !!projectId }
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

/**
 * Flip a brand's cutover switch (KAN-791/794).
 *
 * This is how a human records the client's sign-off decision — the system never
 * infers it. Enabling makes v3 live for every operator on that brand at their
 * next page load; disabling is the documented rollback. Both are audited
 * server-side with the acting user and the reason.
 */
export function useSetV3UiEnabled() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { projectId: number; enabled: boolean; reason?: string }) =>
      scoringApi.setV3UiEnabled(vars.projectId, vars.enabled, vars.reason),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: scoringKeys.all })
      toast.success(
        data.enabled
          ? i18n.t('toasts.scoring.liveEnabled', {
              defaultValue: 'v3 is now live for operators on this brand.',
            })
          : i18n.t('toasts.scoring.hiddenAgain', {
              defaultValue:
                'v3 hidden from operators again. Scoring keeps running in the background.',
            })
      )
    },
    onError: () =>
      toast.error(
        i18n.t('toasts.scoring.settingChangeFailed', {
          defaultValue: 'Could not change the setting. Do you have permission?',
        })
      ),
  })
}

/** Months this brand has v3 results for, newest first. Empty until the job runs. */
export function useV3ScoredMonths(projectId: number | undefined) {
  return useQuery({
    queryKey: [...scoringKeys.all, 'months', projectId ?? 0],
    queryFn: () => scoringApi.getV3ScoredMonths(projectId as number),
    enabled: !!projectId,
    staleTime: 5 * 60_000,
  })
}

/** Predicted-vs-actual calibration for a scored month (KAN-794 sign-off gate).
 *  404s / empty until the month has elapsed and payments exist — the page treats
 *  a failure as "not ready yet", not as an error. */
export function useV3Calibration(
  projectId: number | undefined,
  monthStart: string,
  options: { enabled?: boolean } = {}
) {
  return useQuery({
    queryKey: [...scoringKeys.all, 'calibration', projectId ?? 0, monthStart],
    queryFn: () => scoringApi.getV3Calibration(projectId as number, monthStart),
    enabled: !!projectId && !!monthStart && (options.enabled ?? true),
    retry: false, // "no data yet" is the normal case early in a shadow run
    staleTime: 5 * 60_000,
  })
}

/** Month-over-month drift for a brand (KAN-794). */
export function useV3Drift(
  projectId: number | undefined,
  fromMonth: string,
  toMonth: string,
  options: { enabled?: boolean } = {}
) {
  return useQuery({
    queryKey: [...scoringKeys.all, 'drift', projectId ?? 0, fromMonth, toMonth],
    queryFn: () => scoringApi.getV3Drift(projectId as number, fromMonth, toMonth),
    enabled: !!projectId && !!fromMonth && !!toMonth && (options.enabled ?? true),
    retry: false, // needs two scored months; absent early in the run
    staleTime: 5 * 60_000,
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
      toast.success(
        i18n.t('toasts.scoring.started', {
          defaultValue: 'Scoring started — refresh in a moment to see updates.',
        })
      )
      // Invalidate the whole v3 namespace, not just the lists: a run also changes
      // the available months, the monitoring summary and the drift comparison,
      // which the shadow-run report reads.
      setTimeout(() => qc.invalidateQueries({ queryKey: scoringKeys.all }), 4000)
    },
    onError: () =>
      toast.error(
        i18n.t('toasts.scoring.startFailed', { defaultValue: 'Could not start scoring.' })
      ),
  })
}

/** A brand's v3 tunables + the defaults they sit on (KAN-792). */
export function useV3Settings(projectId: number | undefined) {
  return useQuery({
    queryKey: [...scoringKeys.all, 'settings', projectId ?? 0],
    queryFn: () => scoringApi.getV3Settings(projectId as number),
    enabled: !!projectId,
    // No staleTime: these drive the next scoring run, so showing a cached value
    // after someone else edited them would be actively misleading.
    staleTime: 0,
  })
}

/**
 * Save a brand's v3 tunables.
 *
 * Server-side validation is the only validation that matters (the scoring job
 * reads the stored values, not the form), so a rejected field comes back as a
 * 422 and is surfaced verbatim rather than being pre-empted client-side.
 */
export function useUpdateV3Settings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { projectId: number; settings: V3Settings; reason?: string }) =>
      scoringApi.updateV3Settings(vars.projectId, vars.settings, vars.reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: scoringKeys.all })
      toast.success(
        i18n.t('toasts.scoring.settingsSaved', {
          defaultValue: 'Saved. The next scoring run will use these values.',
        })
      )
    },
    onError: (err: unknown) => {
      const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
      toast.error(
        typeof detail === 'string'
          ? detail
          : i18n.t('toasts.scoring.settingsSaveFailed', {
              defaultValue: 'Could not save. Check the values and try again.',
            })
      )
    },
  })
}

/** Clients per v3 bucket for the client-list summary cards (KAN-791). */
export function useV3ClientSummary(
  projectId: number | undefined,
  monthStart?: string,
  options: { enabled?: boolean } = {}
) {
  return useQuery({
    queryKey: [...scoringKeys.all, 'client-summary', projectId ?? 0, monthStart ?? null],
    queryFn: () => scoringApi.getV3ClientSummary(projectId as number, monthStart),
    enabled: !!projectId && (options.enabled ?? true),
    staleTime: 60_000,
  })
}

/** Brand-wide client counts per v3 bucket, unaffected by list filters (KAN-791). */
export function useV3BucketCounts(
  projectId: number | undefined,
  options: { enabled?: boolean } = {}
) {
  return useQuery({
    queryKey: [...scoringKeys.all, 'bucket-counts', projectId ?? 0],
    queryFn: () => scoringApi.getV3BucketCounts(projectId as number),
    enabled: !!projectId && (options.enabled ?? true),
    staleTime: 60_000,
  })
}
