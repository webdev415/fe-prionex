import { keepPreviousData, useQuery } from '@tanstack/react-query'
import {
  getTaskHistory,
  getTaskHistoryAnalytics,
  getWeeklyBucket,
  listTaskSubjects,
} from '../api/actionAnalysisService'
import type { TaskHistoryAnalyticsFilters, TaskHistoryFilters, WeeklyBucketFilters } from '../types'

export const taskHistoryKeys = {
  all: ['action-analysis', 'task-history'] as const,
  list: (filters: TaskHistoryFilters) => [...taskHistoryKeys.all, 'list', filters] as const,
  analytics: (filters: TaskHistoryAnalyticsFilters) =>
    [...taskHistoryKeys.all, 'analytics', filters] as const,
  subjects: () => [...taskHistoryKeys.all, 'subjects'] as const,
}

export const weeklyTasksKeys = {
  all: ['action-analysis', 'weekly-tasks'] as const,
  bucket: (filters: WeeklyBucketFilters) => [...weeklyTasksKeys.all, 'bucket', filters] as const,
}

export function useWeeklyBucket(filters: WeeklyBucketFilters, enabled = true) {
  return useQuery({
    queryKey: weeklyTasksKeys.bucket(filters),
    queryFn: () => getWeeklyBucket(filters),
    enabled,
    staleTime: 30_000,
  })
}

export function useTaskHistory(filters: TaskHistoryFilters, enabled = true) {
  return useQuery({
    queryKey: taskHistoryKeys.list(filters),
    queryFn: () => getTaskHistory(filters),
    enabled,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  })
}

export function useTaskHistoryAnalytics(filters: TaskHistoryAnalyticsFilters, enabled = true) {
  return useQuery({
    queryKey: taskHistoryKeys.analytics(filters),
    queryFn: () => getTaskHistoryAnalytics(filters),
    enabled,
    staleTime: 30_000,
  })
}

export function useTaskSubjects(enabled = true) {
  return useQuery({
    queryKey: taskHistoryKeys.subjects(),
    queryFn: () => listTaskSubjects(),
    enabled,
    staleTime: 5 * 60_000,
  })
}
