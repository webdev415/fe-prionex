/**
 * useProjects Hook
 *
 * React Query hook for fetching paginated projects list.
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
