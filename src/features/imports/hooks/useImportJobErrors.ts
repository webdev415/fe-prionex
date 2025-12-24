/**
 * useImportJobErrors Hook
 *
 * React Query hook for fetching import job errors.
 */

import { useQuery, type UseQueryOptions } from '@tanstack/react-query'
import { importsApi } from '../api/importsApi'
import { importJobsKeys } from './useImportJobs'
import type { ImportErrorsResponse } from '../types'

/**
 * Fetch import job errors
 *
 * @param jobId - Import job ID
 * @param params - Optional pagination parameters
 * @param options - Additional React Query options
 * @returns React Query result with import errors
 *
 * @example
 * ```tsx
 * const { data: errors, isLoading } = useImportJobErrors(1, { page: 1, page_size: 10 })
 * ```
 */
export function useImportJobErrors(
  jobId: number | string | undefined | null,
  params?: { page?: number; page_size?: number },
  options?: Omit<UseQueryOptions<ImportErrorsResponse>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: [...importJobsKeys.errors(jobId as number | string), params],
    queryFn: () => importsApi.getImportJobErrors(jobId as number | string, params),
    enabled: !!jobId && (options?.enabled ?? true),
    ...options,
  })
}
