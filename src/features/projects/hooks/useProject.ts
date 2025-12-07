/**
 * useProject Hook
 *
 * React Query hook for fetching a single project.
 */

import { useQuery, type UseQueryOptions } from '@tanstack/react-query'
import { projectsApi } from '../api/projectsApi'
import { projectsKeys } from './useProjects'
import type { ProjectDetailResponse } from '../types'

/**
 * Hook to fetch a single project by ID
 */
export function useProject(
  projectId: number,
  options?: Omit<UseQueryOptions<ProjectDetailResponse>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: projectsKeys.detail(projectId),
    queryFn: () => projectsApi.getProject(projectId),
    enabled: projectId > 0 && (options?.enabled ?? true),
    ...options,
  })
}
