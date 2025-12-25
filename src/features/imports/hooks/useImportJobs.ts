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
  list: (params: ImportJobsListParams) => {
    // Serialize params to ensure proper query key comparison
    // This ensures React Query detects changes in params
    const serializedParams = {
      page: params.page,
      page_size: params.page_size,
      search: params.search,
      status: params.status,
      uploaded_by: params.uploaded_by,
      date_from: params.date_from,
      date_to: params.date_to,
      exclude_status: params.exclude_status,
    }
    return [...importJobsKeys.lists(), serializedParams] as const
  },
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
 * 
 * const { data, isLoading, error } = useImportJobs({ page: 1, status: 'completed' })
 *  */
export function useImportJobs(params: ImportJobsListParams = {}) {
  return useQuery({
    queryKey: importJobsKeys.list(params),
    queryFn: () => importsApi.getImportJobs(params),
    // Ensure query refetches when params change
    enabled: true, // Explicitly enable the query
    // Refetch when window regains focus (optional, but good for UX)
    refetchOnWindowFocus: false, // Set to false if you don't want auto-refetch on focus
  })
}
