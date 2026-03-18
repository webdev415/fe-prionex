/**
 * Hooks for Operator Assignment feature.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { operatorAssignmentApi } from '../api/operatorAssignmentApi'
import { importJobsKeys } from './useImportJobs'
import { getErrorMessage } from '@/lib/errors'
import type { OAExecuteRequest } from '../types/operatorAssignment'

/**
 * Hook to upload operator assignment CSV and get preview.
 */
export function useOperatorAssignmentUpload() {
  return useMutation({
    mutationFn: ({ file, projectId }: { file: File; projectId: number }) =>
      operatorAssignmentApi.uploadOperatorAssignment(file, projectId),
    onError: (error) => {
      toast.error(getErrorMessage(error))
    },
  })
}

/**
 * Hook to execute a validated operator assignment job.
 */
export function useOperatorAssignmentExecute() {
  const queryClient = useQueryClient()
  const { t } = useTranslation('common')

  return useMutation({
    mutationFn: ({ jobId, request }: { jobId: number; request?: OAExecuteRequest }) =>
      operatorAssignmentApi.executeOperatorAssignment(jobId, request),
    onSuccess: () => {
      toast.success(t('pages.imports.operatorAssignment.progress.jobStarted'))
      queryClient.invalidateQueries({ queryKey: importJobsKeys.lists() })
    },
    onError: (error) => {
      toast.error(getErrorMessage(error))
    },
  })
}

/**
 * Hook to download CSV template.
 * Generates the template client-side to avoid dependency on backend availability.
 */
export function useDownloadOATemplate() {
  return useMutation({
    mutationFn: async () => {
      const csvContent = 'client_id,operator_id\n'
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      return blob
    },
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'operator_assignment_template.csv'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    },
    onError: (error) => {
      toast.error(getErrorMessage(error))
    },
  })
}
