/**
 * Import Mutation Hooks
 *
 * React Query mutation hooks for import operations.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { importsApi } from '../api/importsApi'
import { importJobsKeys } from './useImportJobs'
import { getErrorMessage } from '@/lib/errors'
import type { UploadImportRequest } from '../types'

/**
 * Hook to upload import file(s)
 */
export function useUploadImport() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (request: UploadImportRequest) => importsApi.uploadImport(request),
    onSuccess: (data) => {
      toast.success('Import started successfully')
      // Invalidate import jobs list to show new job
      queryClient.invalidateQueries({ queryKey: importJobsKeys.lists() })
      // Optionally prefetch the new job detail
      if (data.job_id) {
        queryClient.prefetchQuery({
          queryKey: importJobsKeys.detail(data.job_id),
          queryFn: () => importsApi.getImportJobDetail(data.job_id),
        })
      }
    },
    onError: (error) => {
      toast.error(getErrorMessage(error))
    },
  })
}

/**
 * Hook to cancel an import job
 */
export function useCancelImport() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (jobId: number | string) => importsApi.cancelImportJob(jobId),
    onSuccess: (_, jobId) => {
      toast.success('Import cancelled successfully')
      // Invalidate the specific job and jobs list
      queryClient.invalidateQueries({ queryKey: importJobsKeys.detail(jobId) })
      queryClient.invalidateQueries({ queryKey: importJobsKeys.lists() })
    },
    onError: (error) => {
      toast.error(getErrorMessage(error))
    },
  })
}

/**
 * Hook to export import job errors as CSV
 */
export function useExportImportErrors() {
  return useMutation({
    mutationFn: (jobId: number | string) => importsApi.exportImportJobErrors(jobId),
    onSuccess: (blob, jobId) => {
      // Create download link
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `import_errors_${jobId}_${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('Errors exported successfully')
    },
    onError: (error) => {
      toast.error(getErrorMessage(error))
    },
  })
}

/**
 * Hook to validate CSV structure
 */
export function useValidateCSV() {
  return useMutation({
    mutationFn: (file: File) => importsApi.validateCSV(file),
    onError: (error) => {
      // Don't show toast for validation errors - handled in component
      console.error('CSV validation error:', error)
    },
  })
}
