/**
 * useProjects Hook
 *
 * React Query hooks for fetching projects.
 * Updated: 2025-12-08 - Added useProjectDetail hook
 */

import { useQuery } from '@tanstack/react-query'
import { projectsApi } from '../api/projectsApi'
import type { ProjectListParams } from '../types'

/**
 * Query key factory for projects
 */
export const projectsKeys = {
  all: ['projects'] as const,
  lists: () => [...projectsKeys.all, 'list'] as const,
  list: (params: ProjectListParams) => [...projectsKeys.lists(), params] as const,
  details: () => [...projectsKeys.all, 'detail'] as const,
  detail: (id: number) => [...projectsKeys.details(), id] as const,
}

/**
 * Hook to fetch projects list
 */
export function useProjects(params: ProjectListParams = {}) {
  return useQuery({
    queryKey: projectsKeys.list(params),
    queryFn: () => projectsApi.getProjects(params),
  })
}

/**
 * Hook to fetch a single project detail
 */
export function useProjectDetail(projectId: number | null) {
  return useQuery({
    queryKey: projectsKeys.detail(projectId ?? 0),
    queryFn: () => projectsApi.getProject(projectId!),
    enabled: projectId !== null && projectId > 0,
  })
}
