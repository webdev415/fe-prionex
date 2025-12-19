/**
 * useImportJobs Hook
 *
 * React Query hook for fetching paginated import jobs list.
 */

import { useQuery } from '@tanstack/react-query'
import { importsApi } from '../api/importsApi'
import type { ImportJobsListParams } from '../types'

/**
 * Query key factory for import jobs queries
 */
export const importJobsKeys = {
  all: ['import-jobs'] as const,
  lists: () => [...importJobsKeys.all, 'list'] as const,
  list: (params: ImportJobsListParams) => [...importJobsKeys.lists(), params] as const,
  details: () => [...importJobsKeys.all, 'detail'] as const,
  detail: (id: number | string) => [...importJobsKeys.details(), id] as const,
  errors: (id: number | string) => [...importJobsKeys.detail(id), 'errors'] as const,
}

/**
 * Fetch paginated import jobs list
 *
 * @param params - Query parameters for filtering and pagination
 * @returns React Query result with import jobs data
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = useImportJobs({ page: 1, status: 'completed' })
 * ```
 */
export function useImportJobs(params: ImportJobsListParams = {}) {
  return useQuery({
    queryKey: importJobsKeys.list(params),
    queryFn: () => importsApi.getImportJobs(params),
  })
}
