/**
 * useProject Hook
 *
 * React Query hook for fetching a single project.
 */

import { useQuery } from '@tanstack/react-query'
import { projectsApi } from '../api/projectsApi'
import { projectsKeys } from './useProjects'

/**
 * Hook to fetch a single project by ID
 */
export function useProject(projectId: number) {
  return useQuery({
    queryKey: projectsKeys.detail(projectId),
    queryFn: () => projectsApi.getProject(projectId),
  })
}
