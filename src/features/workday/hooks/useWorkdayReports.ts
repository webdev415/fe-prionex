/**
 * Workday Report Hooks
 *
 * React Query hooks for the four workday endpoints. Same policy as the sibling
 * report tabs: the whole params object is the key (project, period, mode and
 * timezone each refetch on change), `staleTime` 60 s, no query-level retry.
 * The axios-level transient retry is switched off for these endpoints as well
 * — see `api/workdayApi.ts` — so a 503 reaches the tab after ONE request.
 */

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import {
  getWorkdayBreaks,
  getWorkdayReport,
  getWorkmonthDays,
  getWorkmonthReport,
} from '../api/workdayApi'
import type {
  WorkdayBreaksParams,
  WorkdayBreaksResponse,
  WorkdayCallsMode,
  WorkdayReportParams,
  WorkdayReportResponse,
  WorkmonthDaysParams,
  WorkmonthDaysResponse,
  WorkmonthReportParams,
  WorkmonthReportResponse,
} from '../api/types'

export const workdayReportKeys = {
  all: ['workdayReport'] as const,
  day: (params: WorkdayReportParams) => [...workdayReportKeys.all, 'day', params] as const,
  breaks: (userId: number, params: WorkdayBreaksParams) =>
    [...workdayReportKeys.all, 'breaks', userId, params] as const,
  month: (params: WorkmonthReportParams) => [...workdayReportKeys.all, 'month', params] as const,
  monthDays: (userId: number, params: WorkmonthDaysParams) =>
    [...workdayReportKeys.all, 'monthDays', userId, params] as const,
}

/**
 * Same as every sibling report tab. Today's day is computed LIVE on the
 * server (with its own 60 s cache), so a shorter value would buy nothing.
 */
const STALE_TIME_MS = 60_000

function withTimezone<T extends object>(params: T, timezone?: string | null): T {
  return timezone ? { ...params, timezone } : params
}

export interface UseWorkdayReportParams {
  projectId: number
  day: string
  calls: WorkdayCallsMode
  timezone?: string | null
  enabled?: boolean
}

export function useWorkdayReport({
  projectId,
  day,
  calls,
  timezone,
  enabled = true,
}: UseWorkdayReportParams) {
  const params = withTimezone<WorkdayReportParams>({ project_id: projectId, day, calls }, timezone)
  return useQuery<WorkdayReportResponse>({
    queryKey: workdayReportKeys.day(params),
    queryFn: () => getWorkdayReport(params),
    // The previous day's rows stay visible under the busy overlay while the
    // next one loads (the tab marks them as such).
    placeholderData: keepPreviousData,
    enabled: enabled && !!projectId && !!day,
    staleTime: STALE_TIME_MS,
    retry: false,
  })
}

export interface UseWorkdayBreaksParams {
  projectId: number
  /** Null = the modal is closed; nothing is requested. */
  userId: number | null
  day: string
  timezone?: string | null
}

export function useWorkdayBreaks({ projectId, userId, day, timezone }: UseWorkdayBreaksParams) {
  const params = withTimezone<WorkdayBreaksParams>({ project_id: projectId, day }, timezone)
  return useQuery<WorkdayBreaksResponse>({
    queryKey: workdayReportKeys.breaks(userId ?? 0, params),
    queryFn: () => getWorkdayBreaks(userId as number, params),
    // No placeholder: a modal must never show another operator's breaks.
    enabled: userId !== null && !!projectId && !!day,
    staleTime: STALE_TIME_MS,
    retry: false,
  })
}

export interface UseWorkmonthReportParams {
  projectId: number
  month: string
  timezone?: string | null
  enabled?: boolean
}

export function useWorkmonthReport({
  projectId,
  month,
  timezone,
  enabled = true,
}: UseWorkmonthReportParams) {
  const params = withTimezone<WorkmonthReportParams>({ project_id: projectId, month }, timezone)
  return useQuery<WorkmonthReportResponse>({
    queryKey: workdayReportKeys.month(params),
    queryFn: () => getWorkmonthReport(params),
    placeholderData: keepPreviousData,
    enabled: enabled && !!projectId && !!month,
    staleTime: STALE_TIME_MS,
    retry: false,
  })
}

export interface UseWorkmonthDaysParams {
  projectId: number
  /** Null = the modal is closed; nothing is requested. */
  userId: number | null
  month: string
  timezone?: string | null
}

export function useWorkmonthDays({ projectId, userId, month, timezone }: UseWorkmonthDaysParams) {
  const params = withTimezone<WorkmonthDaysParams>({ project_id: projectId, month }, timezone)
  return useQuery<WorkmonthDaysResponse>({
    queryKey: workdayReportKeys.monthDays(userId ?? 0, params),
    queryFn: () => getWorkmonthDays(userId as number, params),
    enabled: userId !== null && !!projectId && !!month,
    staleTime: STALE_TIME_MS,
    retry: false,
  })
}
