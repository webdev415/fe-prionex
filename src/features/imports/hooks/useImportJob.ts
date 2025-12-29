/**
 * useImportJob Hook
 *
 * React Query hook for fetching single import job detail.
 */

import { useQuery, type UseQueryOptions } from '@tanstack/react-query'
import { importsApi } from '../api/importsApi'
import { importJobsKeys } from './useImportJobs'
import type { ImportJobDetail } from '../types'

/**
 * Fetch single import job detail by ID
 *
 * @param jobId - Import job ID
 * @param options - Additional React Query options
 * @returns React Query result with import job detail
 *
 * @example
 * ```tsx
 * const { data: job, isLoading } = useImportJob(1)
 * ```
 */
export function useImportJob(
  jobId: number | string | undefined | null,
  options?: Omit<UseQueryOptions<ImportJobDetail>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: importJobsKeys.detail(jobId as number | string),
    queryFn: () => importsApi.getImportJobDetail(jobId as number | string),
    enabled: !!jobId && (options?.enabled ?? true),
    ...options,
  })
}
